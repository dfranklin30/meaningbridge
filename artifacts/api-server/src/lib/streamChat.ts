import type { Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export type ChatTurn = { role: "user" | "assistant"; content: string };

// Guardrails for the stateless corner-bubble endpoints (concierge + provider
// general help). Both trust a client-supplied transcript, so we cap how much of
// it we forward to the model.
const MAX_TURNS = 24;
const MAX_CHARS = 6000;

/**
 * Stream a stateless, single-turn-at-a-time chat reply over SSE, mirroring the
 * frame contract the chat route uses (`data: {type: delta|done|error}`). Nothing
 * is persisted — the client owns the transcript. Used by the always-on bubble
 * for the public concierge and the clinician general-help personas.
 */
export async function streamStatelessChat(opts: {
  res: Response;
  system: string;
  messages: ChatTurn[];
  log: { error: (obj: unknown, msg?: string) => void };
}): Promise<void> {
  const { res, system, log } = opts;

  const messages = opts.messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (e: object) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    send({ type: "error", message: "A user message is required" });
    res.end();
    return;
  }

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system,
      messages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ type: "delta", text: event.delta.text });
      }
    }
    send({ type: "done" });
  } catch (err) {
    log.error({ err }, "stateless chat stream error");
    send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
  } finally {
    res.end();
  }
}
