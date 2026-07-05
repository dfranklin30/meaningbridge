import type OpenAI from "openai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

/**
 * The OpenRouter client module throws at import time if its env vars are unset.
 * Importing it lazily keeps a misconfigured OpenRouter from crashing API boot —
 * the config error surfaces as a normal attempt failure so Anthropic fallback
 * stays reachable. A failed import is not cached, so it retries on the next call.
 */
type OpenRouterClient = (typeof import("@workspace/integrations-openrouter-ai"))["openrouter"];
let openrouterClientPromise: Promise<OpenRouterClient> | null = null;
function getOpenRouter(): Promise<OpenRouterClient> {
  if (!openrouterClientPromise) {
    const p = import("@workspace/integrations-openrouter-ai").then(
      (m) => m.openrouter,
    );
    p.catch(() => {
      openrouterClientPromise = null;
    });
    openrouterClientPromise = p;
  }
  return openrouterClientPromise;
}

/**
 * AI provider seam. All companion + professional generation flows through here so
 * we can route to NVIDIA Nemotron models (via the Replit OpenRouter integration)
 * as the primary provider, and fall back to Anthropic Claude when OpenRouter
 * errors — the app never goes silent.
 *
 * OpenRouter (through Replit AI Integrations) is chat-completions only: no audio
 * transcription and no image generation. The Replit-managed OpenRouter account's
 * data policy rejects `:free` models ("no endpoints matching your guardrail
 * restrictions and data policy"), so only paid Nemotron models are usable — and
 * none of the paid Nemotron models accept image input. Companion turns that
 * carry an image are therefore routed straight to Anthropic (vision-capable);
 * text-only turns use the Nemotron primary with an Anthropic fallback.
 */

// Companion model: text-only paid Nemotron. Fast and cost-effective. Image turns
// bypass this and go to Anthropic (see companionStream) because no paid Nemotron
// model accepts image input through the integration.
export const COMPANION_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
// Deeper-reasoning model for the clinician-side assistant / case summaries.
export const PROFESSIONAL_MODEL = "nvidia/nemotron-3-super-120b-a12b";
// Anthropic fallback used whenever the primary provider fails, and the primary
// provider for any companion turn that carries an image.
const FALLBACK_MODEL = "claude-sonnet-4-5";

// NVIDIA Nemotron models expose a reasoning toggle via the system prompt. Left
// on, they leak their scratchpad ("The user says...") into user-facing prose, so
// we force it off and prepend the directive to every Nemotron system message.
function nemotronSystem(system: string): string {
  return `detailed thinking off\n\n${system}`;
}

const ALLOWED_MEDIA_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// Server-side cap on the decoded image payload that reaches the model. The
// browser also limits attachments, but a direct API caller could bypass that.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface NormalizedImage {
  mediaType: AllowedMediaType;
  base64: string;
}

/**
 * Parse and validate base64 image data URLs. Drops anything malformed, of an
 * unsupported type, or larger than the cap, rather than forwarding it.
 */
export function parseImages(dataUrls: string[] | undefined): NormalizedImage[] {
  const out: NormalizedImage[] = [];
  for (const dataUrl of dataUrls ?? []) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) continue;
    const mediaType = match[1] as AllowedMediaType;
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) continue;
    const decodedBytes = Buffer.from(match[2], "base64").length;
    if (decodedBytes === 0 || decodedBytes > MAX_IMAGE_BYTES) continue;
    out.push({ mediaType, base64: match[2] });
  }
  return out;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CompanionStreamInput {
  system: string;
  /** Full conversation history, oldest first, including the latest user turn. */
  history: ChatTurn[];
  /** Images to attach to the final user turn only (ephemeral, not persisted). */
  images?: NormalizedImage[];
  maxTokens?: number;
}

function buildOpenAIMessages(
  input: CompanionStreamInput,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const images = input.images ?? [];
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: nemotronSystem(input.system) },
  ];
  input.history.forEach((m, i) => {
    const isLastUserTurn =
      i === input.history.length - 1 && m.role === "user" && images.length > 0;
    if (isLastUserTurn) {
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map(
        (im) => ({
          type: "image_url",
          image_url: { url: `data:${im.mediaType};base64,${im.base64}` },
        }),
      );
      if (m.content.trim()) parts.push({ type: "text", text: m.content });
      messages.push({ role: "user", content: parts });
    } else if (m.role === "assistant") {
      messages.push({ role: "assistant", content: m.content });
    } else {
      messages.push({ role: "user", content: m.content });
    }
  });
  return messages;
}

type AnthropicMessages = Parameters<typeof anthropic.messages.stream>[0]["messages"];

function buildAnthropicMessages(input: CompanionStreamInput): AnthropicMessages {
  const images = input.images ?? [];
  return input.history.map((m, i) => {
    const isLastUserTurn =
      i === input.history.length - 1 && m.role === "user" && images.length > 0;
    if (isLastUserTurn) {
      const blocks = images.map((im) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: im.mediaType,
          data: im.base64,
        },
      }));
      const content = m.content.trim()
        ? [...blocks, { type: "text" as const, text: m.content }]
        : blocks;
      return { role: "user" as const, content };
    }
    return { role: m.role, content: m.content };
  });
}

async function* streamOpenRouter(
  input: CompanionStreamInput,
  model: string,
): AsyncGenerator<string> {
  const openrouter = await getOpenRouter();
  const stream = await openrouter.chat.completions.create({
    model,
    max_tokens: input.maxTokens ?? 4096,
    messages: buildOpenAIMessages(input),
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamAnthropic(input: CompanionStreamInput): AsyncGenerator<string> {
  const stream = await anthropic.messages.stream({
    model: FALLBACK_MODEL,
    max_tokens: input.maxTokens ?? 4096,
    system: input.system,
    messages: buildAnthropicMessages(input),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/**
 * Stream the companion reply. Text-only turns try OpenRouter Nemotron (once + one
 * retry), then fall back to Anthropic Claude. Turns that carry an image go
 * straight to Anthropic, the only vision-capable provider available here. If a
 * provider fails AFTER emitting tokens we cannot safely restart, so the error
 * propagates rather than duplicating text.
 */
export async function* companionStream(
  input: CompanionStreamInput,
): AsyncGenerator<string> {
  const hasImages = (input.images?.length ?? 0) > 0;
  const attempts: Array<{ label: string; run: () => AsyncGenerator<string> }> =
    hasImages
      ? [{ label: "anthropic-vision", run: () => streamAnthropic(input) }]
      : [
          { label: "openrouter", run: () => streamOpenRouter(input, COMPANION_MODEL) },
          { label: "openrouter-retry", run: () => streamOpenRouter(input, COMPANION_MODEL) },
          { label: "anthropic-fallback", run: () => streamAnthropic(input) },
        ];
  let lastErr: unknown;
  for (const attempt of attempts) {
    let emitted = false;
    try {
      for await (const chunk of attempt.run()) {
        emitted = true;
        yield chunk;
      }
      if (emitted) return;
      // A stream that completed without emitting any tokens is a soft failure:
      // returning here would send an empty assistant reply. Fall through to the
      // next provider instead. (This is pre-emission, so restarting is safe.)
      lastErr = new Error(`empty stream from ${attempt.label}`);
      logger.warn(
        { attempt: attempt.label, emitted: false },
        "companion stream produced no tokens; trying next provider",
      );
    } catch (err) {
      lastErr = err;
      logger.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          attempt: attempt.label,
          emitted,
        },
        "companion stream attempt failed",
      );
      // Tokens already reached the client; restarting would duplicate text.
      if (emitted) throw err;
    }
  }
  throw lastErr;
}

/**
 * Non-streaming completion for the clinician-side assistant / reasoning tasks.
 * Uses the deeper-reasoning Nemotron model, falling back to Anthropic on error
 * or empty output.
 */
export async function professionalComplete(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const maxTokens = input.maxTokens ?? 1024;
  try {
    const openrouter = await getOpenRouter();
    const res = await openrouter.chat.completions.create({
      model: PROFESSIONAL_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: nemotronSystem(input.system) },
        { role: "user", content: input.user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    if (text.trim()) return text.trim();
    throw new Error("empty professional completion");
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "professional completion falling back to anthropic",
    );
    const msg = await anthropic.messages.create({
      model: FALLBACK_MODEL,
      max_tokens: maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    return msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }
}

/**
 * Non-streaming companion completion for short, warm generated copy (e.g. the
 * daily dashboard greeting). Uses the fast companion Nemotron model as primary,
 * falling back to Anthropic on error or empty output so a greeting is never
 * blocked by a single provider hiccup.
 */
export async function companionComplete(input: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const maxTokens = input.maxTokens ?? 400;
  try {
    const openrouter = await getOpenRouter();
    const res = await openrouter.chat.completions.create({
      model: COMPANION_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: nemotronSystem(input.system) },
        { role: "user", content: input.user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    if (text.trim()) return text.trim();
    throw new Error("empty companion completion");
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "companion completion falling back to anthropic",
    );
    const msg = await anthropic.messages.create({
      model: FALLBACK_MODEL,
      max_tokens: maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    return msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }
}
