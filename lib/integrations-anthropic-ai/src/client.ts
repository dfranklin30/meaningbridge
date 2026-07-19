/**
 * Gemini-backed drop-in replacement for the Anthropic client.
 *
 * The app was built against `anthropic.messages.create` / `.stream` from
 * @anthropic-ai/sdk. On Google Cloud we run on Gemini's free tier through its
 * OpenAI-compatible endpoint instead, so this module re-implements the two
 * methods the codebase actually uses on top of the OpenAI SDK:
 *
 *   - messages.create({ model, max_tokens, system, messages }) ->
 *       { content: [{ type: "text", text }] }
 *   - messages.stream({ ... }) -> AsyncIterable of
 *       { type: "content_block_delta", delta: { type: "text_delta", text } }
 *
 * Anthropic-style message content (plain strings, text blocks, and base64
 * image blocks) is translated to OpenAI chat format; Gemini 2.5 Flash is
 * vision-capable so image turns keep working. Whatever Claude model name a
 * call site passes is mapped to GEMINI_CHAT_MODEL (default gemini-2.5-flash).
 *
 * Env (same names as before, new values):
 *   AI_INTEGRATIONS_ANTHROPIC_BASE_URL = https://generativelanguage.googleapis.com/v1beta/openai/
 *   AI_INTEGRATIONS_ANTHROPIC_API_KEY  = <Gemini API key>
 */
import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set (Gemini OpenAI-compatible endpoint).",
  );
}

if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set (Gemini API key).",
  );
}

const client = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";

// ---- Anthropic-shaped request/response types (the subset this app uses) ----

export interface AnthropicTextBlockParam {
  type: "text";
  text: string;
}

export interface AnthropicImageBlockParam {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

export type AnthropicContentBlockParam =
  | AnthropicTextBlockParam
  | AnthropicImageBlockParam;

export interface AnthropicMessageParam {
  role: "user" | "assistant";
  content: string | AnthropicContentBlockParam[];
}

export interface AnthropicMessageCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessageParam[];
}

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export interface AnthropicMessage {
  content: AnthropicTextBlock[];
}

export interface AnthropicTextDeltaEvent {
  type: "content_block_delta";
  delta: { type: "text_delta"; text: string };
}

export type AnthropicStreamEvent =
  | AnthropicTextDeltaEvent
  | { type: "message_stop"; delta?: undefined };

// ---- translation ----

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OpenAIContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

function toOpenAIMessages(params: AnthropicMessageCreateParams): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (params.system?.trim()) {
    out.push({ role: "system", content: params.system });
  }
  for (const m of params.messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content
        .filter((b): b is AnthropicTextBlockParam => b.type === "text")
        .map((b) => b.text)
        .join("");
      out.push({ role: "assistant", content: text });
      continue;
    }
    const parts: OpenAIContentPart[] = m.content.map((b) =>
      b.type === "text"
        ? { type: "text" as const, text: b.text }
        : {
            type: "image_url" as const,
            image_url: {
              url: `data:${b.source.media_type};base64,${b.source.data}`,
            },
          },
    );
    out.push({ role: "user", content: parts });
  }
  return out;
}

async function createMessage(
  params: AnthropicMessageCreateParams,
): Promise<AnthropicMessage> {
  const res = await client.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: params.max_tokens,
    messages: toOpenAIMessages(params),
  });
  const text = res.choices[0]?.message?.content ?? "";
  return { content: [{ type: "text", text }] };
}

type StreamResult = AsyncIterable<AnthropicStreamEvent> &
  PromiseLike<AsyncIterable<AnthropicStreamEvent>>;

function streamMessage(params: AnthropicMessageCreateParams): StreamResult {
  async function* run(): AsyncGenerator<AnthropicStreamEvent> {
    const stream = await client.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: params.max_tokens,
      messages: toOpenAIMessages(params),
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: delta },
        };
      }
    }
    yield { type: "message_stop" };
  }
  // Support both `await anthropic.messages.stream(...)` followed by iteration
  // (the pattern every call site uses) and direct iteration without await.
  const iterable = run();
  const wrapper: StreamResult = {
    [Symbol.asyncIterator]() {
      return iterable[Symbol.asyncIterator]();
    },
    then(onfulfilled, onrejected) {
      return Promise.resolve<AsyncIterable<AnthropicStreamEvent>>(wrapper).then(
        onfulfilled,
        onrejected,
      );
    },
  };
  return wrapper;
}

export const anthropic = {
  messages: {
    create: createMessage,
    stream: streamMessage,
  },
};
