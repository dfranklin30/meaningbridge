import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  db,
  chatSessionsTable,
  chatMessagesTable,
  deceasedTable,
  safetyEventsTable,
  profileTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateChatSessionBody,
  GetChatSessionParams,
  SendChatMessageBody,
} from "@workspace/api-zod";
import { detectCrisis } from "../lib/crisis";
import {
  meaningSystemPrompt,
  continuingBondsSystemPrompt,
  type ConversationType,
} from "../lib/prompts";
import { requireAuth } from "../middlewares/requireAuth";
import { listMemories, memoryBlock, extractAndStoreMemories } from "../lib/companionMemory";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/sessions", async (req, res) => {
  const rows = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, req.userId!))
    .orderBy(desc(chatSessionsTable.createdAt));
  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const body = CreateChatSessionBody.parse(req.body);
  const [row] = await db
    .insert(chatSessionsTable)
    .values({ ...body, userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

router.get("/sessions/:id", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  const [session] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, req.userId!)));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(asc(chatMessagesTable.createdAt));
  res.json({ ...session, messages: msgs });
});

router.delete("/sessions/:id", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  await db
    .delete(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, req.userId!)));
  res.status(204).end();
});

router.post("/sessions/:id/messages", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  const body = SendChatMessageBody.parse(req.body);
  const [session] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, req.userId!)));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  if (!body.content.trim() && (body.images ?? []).length === 0) {
    res.status(400).json({ error: "A message needs text or at least one image." });
    return;
  }

  const crisis = detectCrisis(body.content);
  await db.insert(chatMessagesTable).values({
    sessionId: id,
    role: "user",
    content: body.content,
    crisisFlag: crisis,
  });
  if (crisis) {
    await db.insert(safetyEventsTable).values({
      userId: req.userId!,
      source: "chat",
      severity: "critical",
      note: `Crisis language detected in chat session ${id}`,
    });
  }

  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, req.userId!))
    .limit(1);

  const memories = await listMemories(req.userId!);

  let systemPrompt: string;
  if (session.mode === "continuing-bonds") {
    let deceased = null;
    if (session.deceasedId) {
      const [d] = await db
        .select()
        .from(deceasedTable)
        .where(and(eq(deceasedTable.id, session.deceasedId), eq(deceasedTable.userId, req.userId!)));
      deceased = d ?? null;
    }
    systemPrompt = continuingBondsSystemPrompt({
      profile: profile ?? null,
      deceased,
      conversationType: (session.conversationType as ConversationType | null) ?? null,
    });
  } else {
    systemPrompt = meaningSystemPrompt({ profile: profile ?? null });
  }
  systemPrompt += memoryBlock(memories);

  const history = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(asc(chatMessagesTable.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (e: object) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  if (crisis) {
    send({ type: "crisis" });
  }

  // Vision: the user may attach one or more base64 image data URLs alongside
  // the newest message. Images are not persisted (companion is ephemeral); they
  // are only injected into the final user turn for this single request.
  const ALLOWED_MEDIA_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"] as const;
  type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];
  type ImageBlock = {
    type: "image";
    source: { type: "base64"; media_type: AllowedMediaType; data: string };
  };
  // Server-side size cap. The browser also limits attachments to 5 MB, but a
  // direct API caller could bypass that, so we independently drop any image
  // whose decoded payload exceeds the cap rather than forwarding a huge request
  // to the model.
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const imageBlocks: ImageBlock[] = [];
  for (const dataUrl of body.images ?? []) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) continue;
    const mediaType = match[1] as AllowedMediaType;
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) continue;
    // Decoded (not base64) byte length is the payload that reaches the model.
    const decodedBytes = Buffer.from(match[2], "base64").length;
    if (decodedBytes === 0 || decodedBytes > MAX_IMAGE_BYTES) continue;
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: match[2] },
    });
  }

  const messages = history.map((m, i) => {
    const isLastUserTurn =
      i === history.length - 1 && m.role === "user" && imageBlocks.length > 0;
    if (isLastUserTurn) {
      // Append the text block only when there is text; an image-only turn is a
      // valid Anthropic content array on its own.
      const content = m.content.trim()
        ? [...imageBlocks, { type: "text" as const, text: m.content }]
        : [...imageBlocks];
      return { role: "user" as const, content };
    }
    return { role: m.role as "user" | "assistant", content: m.content };
  });

  try {
    let assistant = "";
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        assistant += event.delta.text;
        send({ type: "delta", text: event.delta.text });
      }
    }
    await db.insert(chatMessagesTable).values({
      sessionId: id,
      role: "assistant",
      content: assistant,
      crisisFlag: false,
    });
    send({ type: "done" });
    // Fire-and-forget: distil durable facts from this exchange so the companion
    // remembers across sessions. Never blocks the response.
    void extractAndStoreMemories({
      userId: req.userId!,
      userText: body.content,
      assistantText: assistant,
      existing: memories.map((m) => m.content),
    });
  } catch (err) {
    req.log.error({ err }, "chat stream error");
    send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
  } finally {
    res.end();
  }
});

export default router;
