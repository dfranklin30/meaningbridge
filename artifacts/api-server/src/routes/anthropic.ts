import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateAnthropicConversationBody,
  GetAnthropicConversationParams,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/conversations", async (req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, req.userId!))
    .orderBy(desc(conversations.createdAt));
  res.json(rows);
});

router.post("/conversations", async (req, res) => {
  const body = CreateAnthropicConversationBody.parse(req.body);
  const [row] = await db
    .insert(conversations)
    .values({ title: body.title, userId: req.userId! })
    .returning();
  res.status(201).json(row);
});

router.get("/conversations/:id", async (req, res) => {
  const { id } = GetAnthropicConversationParams.parse(req.params);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const { id } = GetAnthropicConversationParams.parse(req.params);
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  res.status(204).end();
});

router.get("/conversations/:id/messages", async (req, res) => {
  const { id } = GetAnthropicConversationParams.parse(req.params);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const { id } = GetAnthropicConversationParams.parse(req.params);
  const body = SendAnthropicMessageBody.parse(req.body);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(messages).values({ conversationId: id, role: "user", content: body.content });
  const history = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (e: object) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  try {
    let assistant = "";
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        assistant += event.delta.text;
        send({ type: "delta", text: event.delta.text });
      }
    }
    await db.insert(messages).values({ conversationId: id, role: "assistant", content: assistant });
    send({ type: "done" });
  } catch (err) {
    req.log.error({ err }, "anthropic stream error");
    send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
  } finally {
    res.end();
  }
});

export default router;
