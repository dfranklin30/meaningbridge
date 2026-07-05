import { and, desc, eq } from "drizzle-orm";
import {
  db,
  profileTable,
  companionMemoryTable,
  journalEntriesTable,
  chatSessionsTable,
  checkinsTable,
  companionGreetingsTable,
} from "@workspace/db";
import { companionComplete } from "./aiProvider";
import { logger } from "./logger";

/**
 * The proactive dashboard greeting. On return, the companion greets the person
 * by name and offers ONE gentle next step, built from their own app state
 * (remembered facts, a recent journal theme, how long it has been). Generated on
 * the shared AI seam (NVIDIA Nemotron primary, Anthropic fallback) and cached
 * once per UTC day so it stays steady and is never regenerated on every load.
 */

const ACTIONS = ["journal", "reflection", "talk", "loved_one", "practice"] as const;
export type SuggestionAction = (typeof ACTIONS)[number];

export interface Greeting {
  greeting: string;
  suggestion: { text: string; action: SuggestionAction };
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function pickAction(raw: unknown, fallback: SuggestionAction): SuggestionAction {
  return typeof raw === "string" && (ACTIONS as readonly string[]).includes(raw)
    ? (raw as SuggestionAction)
    : fallback;
}

// The tone constraints (no emoji, no exclamation points, no numbers/scores) are
// stated in the prompt, but we do not trust one model turn to honor them. These
// enforce the rules deterministically before anything is cached or shown.
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const DIGIT_RE = /[0-9]/;

function sanitizeText(s: string): string {
  return s
    .replace(/!+/g, ".")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

/**
 * Repair soft violations (exclamation points) and reject hard ones (emoji, any
 * digit — no scores, streaks, or counts ever reach the person). Returns null
 * when the output cannot be shown, so the caller can offer a safe template.
 */
function enforceConstraints(g: Greeting): Greeting | null {
  const greeting = sanitizeText(g.greeting);
  const text = sanitizeText(g.suggestion.text);
  if (!greeting || !text) return null;
  if (EMOJI_RE.test(greeting) || EMOJI_RE.test(text)) return null;
  if (DIGIT_RE.test(greeting) || DIGIT_RE.test(text)) return null;
  return { greeting, suggestion: { text, action: g.suggestion.action } };
}

const ACTION_FALLBACK_TEXT: Record<SuggestionAction, string> = {
  journal: "Write a few words when you are ready",
  reflection: "Sit with a quiet reflection",
  talk: "Talk with your companion",
  loved_one: "Spend a moment with their profile",
  practice: "Try a calming practice",
};

/**
 * A calm, honest greeting used when the model is unavailable or its output could
 * not be shown. Personalized only by known name and next step — no fabricated
 * detail. Not cached, so a later load can still get a fully generated greeting.
 */
function safeFallback(preferredName: string | null, action: SuggestionAction): Greeting {
  const name = preferredName ? `, ${preferredName}` : "";
  return {
    greeting: `Welcome back${name}. Your companion is here whenever you are ready.`,
    suggestion: { text: ACTION_FALLBACK_TEXT[action], action },
  };
}

const SYSTEM = `You are the MeaningBridge companion — a warm, steady presence for someone living with grief, grounded in Dr. Robert Neimeyer's meaning-reconstruction and continuing-bonds approach.

Write a short greeting for this person as they return to the app. Respond with ONLY a JSON object and nothing else:
{"greeting": "...", "suggestion": {"text": "...", "action": "journal"|"reflection"|"talk"|"loved_one"|"practice"}}

greeting: one or two calm sentences. Address them by their preferred name if it is known. Reference something real and specific from the context — their loved one by name, the theme of a recent journal entry, or how long it has been since they were last here — warmly, as an open door, never as guilt or pressure. If there is little to reference, simply welcome them gently.

suggestion.text: one gentle next step phrased as a soft invitation (a handful of words). suggestion.action must match where that step leads: "journal" to write, "reflection" for a quiet self-reflection, "talk" to talk with the companion, "loved_one" to tend their loved one's profile, "practice" for a calming practice.

Rules: no emojis. No exclamation points. No numbers, scores, streaks, or gamification language. Never claim to be human or a therapist. Keep the whole thing under 55 words. Plain, unhurried language.`;

function parseGreeting(text: string, fallbackAction: SuggestionAction): Greeting | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      greeting?: unknown;
      suggestion?: { text?: unknown; action?: unknown };
    };
    const greeting = typeof obj.greeting === "string" ? obj.greeting.trim() : "";
    const suggestionText =
      typeof obj.suggestion?.text === "string" ? obj.suggestion.text.trim() : "";
    if (!greeting || !suggestionText) return null;
    return {
      greeting,
      suggestion: {
        text: suggestionText,
        action: pickAction(obj.suggestion?.action, fallbackAction),
      },
    };
  } catch {
    return null;
  }
}

/** Today's cached greeting for this person, generating and caching one if absent. */
export async function getOrCreateGreeting(userId: number): Promise<Greeting | null> {
  const dateKey = utcDateKey();

  const [cached] = await db
    .select()
    .from(companionGreetingsTable)
    .where(
      and(
        eq(companionGreetingsTable.userId, userId),
        eq(companionGreetingsTable.dateKey, dateKey),
      ),
    )
    .limit(1);
  if (cached) {
    return {
      greeting: cached.greeting,
      suggestion: {
        text: cached.suggestionText,
        action: pickAction(cached.suggestionAction, "talk"),
      },
    };
  }

  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  const memories = await db
    .select({ content: companionMemoryTable.content })
    .from(companionMemoryTable)
    .where(eq(companionMemoryTable.userId, userId))
    .orderBy(desc(companionMemoryTable.createdAt))
    .limit(8);
  const [lastJournal] = await db
    .select({ title: journalEntriesTable.title, createdAt: journalEntriesTable.createdAt })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(1);
  const [lastSession] = await db
    .select({ createdAt: chatSessionsTable.createdAt })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, userId))
    .orderBy(desc(chatSessionsTable.createdAt))
    .limit(1);
  const [lastCheckin] = await db
    .select({ createdAt: checkinsTable.createdAt })
    .from(checkinsTable)
    .where(eq(checkinsTable.userId, userId))
    .orderBy(desc(checkinsTable.createdAt))
    .limit(1);

  const lastActivity = [lastJournal?.createdAt, lastSession?.createdAt, lastCheckin?.createdAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSinceLastVisit = lastActivity
    ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000)
    : null;

  const context = {
    preferredName: profile?.firstName ?? profile?.name ?? null,
    remembered: memories.map((m) => m.content),
    daysSinceLastVisit,
    lastJournalTitle: lastJournal?.title ?? null,
    hasJournaled: Boolean(lastJournal),
  };

  const fallbackAction: SuggestionAction = !lastJournal
    ? memories.length === 0
      ? "talk"
      : "journal"
    : "reflection";

  let generated: Greeting | null = null;
  try {
    const text = await companionComplete({
      system: SYSTEM,
      user: JSON.stringify(context),
      maxTokens: 300,
    });
    generated = parseGreeting(text, fallbackAction);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "companion greeting generation failed",
    );
  }

  const cleaned = generated ? enforceConstraints(generated) : null;
  if (!cleaned) {
    // The model was unavailable or produced content we will not show. Offer a
    // calm templated greeting instead — and do NOT cache it, so a later load can
    // still receive a fully generated one.
    return safeFallback(context.preferredName, fallbackAction);
  }

  try {
    await db
      .insert(companionGreetingsTable)
      .values({
        userId,
        dateKey,
        greeting: cleaned.greeting,
        suggestionText: cleaned.suggestion.text,
        suggestionAction: cleaned.suggestion.action,
      })
      .onConflictDoNothing();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "companion greeting cache write failed",
    );
  }

  // Re-read the persisted row so that, under a first-write race, every caller on
  // this day converges on the same stored greeting rather than its own draft.
  const [persisted] = await db
    .select()
    .from(companionGreetingsTable)
    .where(
      and(
        eq(companionGreetingsTable.userId, userId),
        eq(companionGreetingsTable.dateKey, dateKey),
      ),
    )
    .limit(1);
  if (persisted) {
    return {
      greeting: persisted.greeting,
      suggestion: {
        text: persisted.suggestionText,
        action: pickAction(persisted.suggestionAction, fallbackAction),
      },
    };
  }
  return cleaned;
}
