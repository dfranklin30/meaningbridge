import { and, desc, eq } from "drizzle-orm";
import {
  db,
  profileTable,
  deceasedTable,
  companionMemoryTable,
  journalEntriesTable,
} from "@workspace/db";
import { companionComplete } from "./aiProvider";
import { logger } from "./logger";

/**
 * Contextual companion copy woven into the app's surfaces (journal prompt,
 * reflection intro, therapist guidance, a note after a photo upload). Each helper
 * builds a small, user-scoped context, asks the shared AI seam for one warm line,
 * then passes it through the same deterministic tone guardrails the greeting uses
 * (no emojis, no exclamation points, no numbers/scores) and falls back to a calm
 * template when the model is unavailable or its output cannot be shown.
 */

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const DIGIT_RE = /[0-9]/;

/** Strip soft violations; return null if hard violations remain (emoji/digits). */
function calm(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/!+/g, ".")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
  if (!cleaned) return null;
  if (EMOJI_RE.test(cleaned) || DIGIT_RE.test(cleaned)) return null;
  return cleaned;
}

/** Take just the first line/sentence-ish chunk so helpers stay to one line. */
function firstLine(text: string): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? text.trim();
  return line;
}

interface PersonContext {
  firstName: string | null;
  lovedOneName: string | null;
  relationship: string | null;
  recentJournalTitles: string[];
  remembered: string[];
  workingWithTherapist: boolean;
}

async function loadPersonContext(userId: number): Promise<PersonContext> {
  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  const [deceased] = await db
    .select({ name: deceasedTable.name, relationship: deceasedTable.relationship })
    .from(deceasedTable)
    .where(eq(deceasedTable.userId, userId))
    .orderBy(desc(deceasedTable.createdAt))
    .limit(1);
  const journals = await db
    .select({ title: journalEntriesTable.title })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.createdAt))
    .limit(5);
  const memories = await db
    .select({ content: companionMemoryTable.content })
    .from(companionMemoryTable)
    .where(eq(companionMemoryTable.userId, userId))
    .orderBy(desc(companionMemoryTable.createdAt))
    .limit(8);

  return {
    firstName: profile?.firstName ?? profile?.name ?? null,
    lovedOneName: deceased?.name ?? null,
    relationship: deceased?.relationship ?? null,
    recentJournalTitles: journals.map((j) => j.title).filter(Boolean),
    remembered: memories.map((m) => m.content),
    workingWithTherapist: profile?.workingWithTherapist ?? false,
  };
}

const BASE_RULES =
  "Rules: no emojis. No exclamation points. No numbers, scores, streaks, or gamification. Never claim to be human or a therapist. Plain, unhurried, warm language.";

async function oneLine(system: string, user: string, maxTokens = 160): Promise<string | null> {
  try {
    const raw = await companionComplete({ system, user, maxTokens });
    return calm(firstLine(raw));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "companion context generation failed",
    );
    return null;
  }
}

/**
 * A gentle journaling prompt drawn from the person's recent themes and what the
 * companion remembers. One sentence, phrased as an open invitation.
 */
export async function journalPrompt(userId: number): Promise<string> {
  const ctx = await loadPersonContext(userId);
  const system = `You are the MeaningBridge companion, grounded in Dr. Robert Neimeyer's grief work. Write ONE gentle journaling prompt (a single sentence, phrased as a soft invitation) for this person, drawing on their recent themes, what is remembered, or their loved one by name when it fits. If there is little to go on, offer a simple, open prompt about how today feels. ${BASE_RULES}`;
  const line = await oneLine(system, JSON.stringify({
    firstName: ctx.firstName,
    lovedOne: ctx.lovedOneName,
    relationship: ctx.relationship,
    recentEntries: ctx.recentJournalTitles,
    remembered: ctx.remembered,
  }));
  if (line) return line;
  return ctx.lovedOneName
    ? `Is there a memory of ${ctx.lovedOneName} that has been near you today?`
    : "What has been sitting closest to your heart today?";
}

/**
 * A short, personal introduction to a reflection exercise that names the loss
 * when known, so the exercise feels held rather than clinical.
 */
export async function reflectionIntro(userId: number, exercise: string): Promise<string> {
  const ctx = await loadPersonContext(userId);
  const system = `You are the MeaningBridge companion. Write ONE or two short sentences introducing a reflective exercise to this person, warmly and personally. Name their loved one if it is known, and set a calm, unhurried tone. Do not explain how the exercise is scored. ${BASE_RULES}`;
  const line = await oneLine(system, JSON.stringify({
    firstName: ctx.firstName,
    lovedOne: ctx.lovedOneName,
    relationship: ctx.relationship,
    exercise,
  }), 220);
  if (line) return line;
  const who = ctx.firstName ? `${ctx.firstName}, ` : "";
  return ctx.lovedOneName
    ? `${who}take your time here. This is a quiet space to notice how your bond with ${ctx.lovedOneName} lives in you now.`
    : `${who}take your time here. There are no right answers, only what is true for you today.`;
}

/**
 * Profile-aware guidance for the therapist directory: what to look for, phrased
 * around this person's situation.
 */
export async function therapistGuidance(userId: number): Promise<string> {
  const ctx = await loadPersonContext(userId);
  const system = `You are the MeaningBridge companion. Write one or two short sentences helping this person think about what to look for in a grief therapist, shaped gently around their situation (their loss, whether they already work with someone). Keep it practical and calm, not clinical jargon. ${BASE_RULES}`;
  const line = await oneLine(system, JSON.stringify({
    firstName: ctx.firstName,
    relationship: ctx.relationship,
    lossKnown: Boolean(ctx.lovedOneName),
    alreadyWorkingWithTherapist: ctx.workingWithTherapist,
  }), 220);
  if (line) return line;
  return "When you reach out, it is enough to say you are grieving and looking for support. A good fit is someone you feel unhurried and safe with.";
}

/**
 * A gentle note offered after a photo of the loved one is added to their profile.
 */
export async function photoNote(userId: number): Promise<string> {
  const ctx = await loadPersonContext(userId);
  const system = `You are the MeaningBridge companion. The person just added a photo of their loved one to that loved one's profile. Offer ONE gentle, warm sentence acknowledging this, naming their loved one if it is known. Do not ask them to do anything. ${BASE_RULES}`;
  const line = await oneLine(system, JSON.stringify({
    firstName: ctx.firstName,
    lovedOne: ctx.lovedOneName,
    relationship: ctx.relationship,
  }));
  if (line) return line;
  return ctx.lovedOneName
    ? `Thank you for sharing this. Seeing ${ctx.lovedOneName} here keeps their presence close.`
    : "Thank you for sharing this. Keeping their image close can be its own quiet comfort.";
}

/**
 * Suggest the community room slug most relevant to this person's loss, or null.
 * Suggestion only — never used to auto-join.
 */
export async function suggestCommunityRoom(
  userId: number,
): Promise<{ slug: string; reason: string } | null> {
  const ctx = await loadPersonContext(userId);
  if (!ctx.relationship) return null;
  const rel = ctx.relationship.toLowerCase();
  const map: Array<[RegExp, string, string]> = [
    [/mother|father|mom|dad|parent/, "loss-of-a-parent", "others who have lost a parent gather here"],
    [/husband|wife|partner|spouse|boyfriend|girlfriend/, "loss-of-a-partner", "others who have lost a partner gather here"],
    [/son|daughter|child|baby/, "loss-of-a-child", "a gentle room for those who have lost a child"],
    [/brother|sister|sibling/, "sibling-loss", "others grieving a sibling gather here"],
    [/dog|cat|pet/, "pet-loss", "a warm room for those grieving a beloved companion animal"],
  ];
  for (const [re, slug, reason] of map) {
    if (re.test(rel)) return { slug, reason };
  }
  return null;
}
