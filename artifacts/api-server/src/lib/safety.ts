import { logger } from "./logger";

/**
 * Content-safety guardrails for the companion. Two independent layers:
 *
 * 1. `moderate()` — machine content moderation via OpenAI's free moderation
 *    endpoint (the OpenRouter data policy blocks the `:free` Nemotron safety
 *    model, so OpenAI moderation is the available substitute). It AUGMENTS the
 *    regex crisis net in `crisis.ts`; it never replaces it. Moderation fails
 *    OPEN: if the endpoint is unconfigured or errors we return "not flagged"
 *    and log, because the regex net still runs and a grief companion must never
 *    refuse to listen just because a network call failed.
 *
 * 2. `classifyTopic()` — a conservative, deterministic heuristic that only
 *    catches unambiguous out-of-scope utility requests (code, homework, market
 *    tips, weather...). It is intentionally narrow so ordinary grief language
 *    can never trip it. The system prompt carries the primary topic policy;
 *    this is a cheap deterministic backstop that lets the app redirect without
 *    spending a model call.
 */

type OpenAIClient = (typeof import("@workspace/integrations-openai-ai-server"))["openai"];
let openaiClientPromise: Promise<OpenAIClient> | null = null;
function getOpenAI(): Promise<OpenAIClient> {
  if (!openaiClientPromise) {
    const p = import("@workspace/integrations-openai-ai-server").then(
      (m) => m.openai,
    );
    p.catch(() => {
      openaiClientPromise = null;
    });
    openaiClientPromise = p;
  }
  return openaiClientPromise;
}

// OpenAI moderation category keys that indicate self-harm risk. These route to
// the warm crisis path, never a cold refusal.
const SELF_HARM_CATEGORIES = [
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
];

export interface ModerationResult {
  /** Any disallowed category was flagged. */
  flagged: boolean;
  /** A self-harm category was flagged (routes to the crisis path). */
  selfHarm: boolean;
  /** The flagged category names (empty when not flagged). */
  categories: string[];
  /** Moderation was unavailable and we failed open. */
  degraded: boolean;
}

const SAFE: ModerationResult = {
  flagged: false,
  selfHarm: false,
  categories: [],
  degraded: false,
};

/**
 * Run OpenAI content moderation on a piece of text. Fails open (returns a
 * not-flagged result with `degraded: true`) if moderation is unavailable.
 */
export async function moderate(text: string): Promise<ModerationResult> {
  const trimmed = text?.trim();
  if (!trimmed) return { ...SAFE };
  try {
    const openai = await getOpenAI();
    // This runs BEFORE the companion reply streams, so a stalled or unsupported
    // moderation endpoint would freeze the entire turn (the UI sits on
    // "Thinking"). Moderation fails open and the deterministic crisis regex still
    // runs, so bounding it with a short timeout is safe and keeps turns snappy.
    const res = await Promise.race([
      openai.moderations.create({
        model: "omni-moderation-latest",
        input: trimmed,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("moderation timed out")), 3500),
      ),
    ]);
    const result = res.results[0];
    if (!result) return { ...SAFE, degraded: true };
    const categories = Object.entries(
      result.categories as unknown as Record<string, boolean>,
    )
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const selfHarm = categories.some((c) => SELF_HARM_CATEGORIES.includes(c));
    return { flagged: Boolean(result.flagged), selfHarm, categories, degraded: false };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "content moderation unavailable; failing open",
    );
    return { ...SAFE, degraded: true };
  }
}

// Narrow, unambiguous out-of-scope requests. Each pattern is specific enough
// that it will not match grief, loss, or emotional-support language.
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(write|debug|fix|refactor|generate)\s+(me\s+)?(some\s+)?code\b/i,
  /\b(python|javascript|typescript|java|c\+\+|html|css|sql)\s+(code|script|function|query|program)\b/i,
  /\bwrite\s+(me\s+)?(a|an|my)\s+(essay|homework|assignment|report|cover letter|resume|program)\b/i,
  /\b(stock|crypto|bitcoin|investment|forex)\s+(tip|tips|advice|price|prediction|recommendation)\b/i,
  /\bwhat('| i)?s?\s+the\s+weather\b/i,
  /\bgive me a recipe\b/i,
  /\b(solve|calculate)\s+(this\s+)?(equation|math problem|integral)\b/i,
  /\btranslate\s+(this|the following)\b/i,
];

export type TopicClass = "in_scope" | "off_topic";

/**
 * Deterministic topic backstop. Returns `off_topic` only for clearly
 * out-of-scope utility requests; everything else (all grief/emotional content)
 * is `in_scope`.
 */
export function classifyTopic(text: string): TopicClass {
  const trimmed = text?.trim();
  if (!trimmed) return "in_scope";
  return OFF_TOPIC_PATTERNS.some((re) => re.test(trimmed))
    ? "off_topic"
    : "in_scope";
}

/** Gentle, on-brand message streamed when a request falls outside grief support. */
export const OFF_TOPIC_REDIRECT =
  "I am here as a companion for grief, loss, and the meaning we carry forward. That is a little outside what I can help with. If something about a loss, a memory, or how you are holding up is on your mind, I would be glad to stay with you there.";

/** Gentle boundary message streamed when moderation flags harmful (non-self-harm) content. */
export const BOUNDARY_REDIRECT =
  "I want to keep this a gentle, safe space, so I am not able to go there. If there is something you are carrying about a loss or how you are feeling, I am here and glad to listen.";
