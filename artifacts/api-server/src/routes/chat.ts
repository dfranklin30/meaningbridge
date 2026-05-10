import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import {
  db,
  chatSessionsTable,
  chatMessagesTable,
  deceasedTable,
  safetyEventsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateChatSessionBody,
  GetChatSessionParams,
  SendChatMessageBody,
} from "@workspace/api-zod";
import { detectCrisis } from "../lib/crisis";
import { meaningSystemPrompt, continuingBondsSystemPrompt } from "../lib/prompts";

const router: IRouter = Router();

router.get("/sessions", async (_req, res) => {
  const rows = await db.select().from(chatSessionsTable).orderBy(desc(chatSessionsTable.createdAt));
  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const body = CreateChatSessionBody.parse(req.body);
  const [row] = await db.insert(chatSessionsTable).values(body).returning();
  res.status(201).json(row);
});

router.get("/sessions/:id", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(asc(chatMessagesTable.createdAt));
  res.json({ ...session, messages: msgs });
});

router.delete("/sessions/:id", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.status(204).end();
});

router.post("/sessions/:id/messages", async (req, res) => {
  const { id } = GetChatSessionParams.parse(req.params);
  const body = SendChatMessageBody.parse(req.body);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  const crisis = detectCrisis(body.content);
  await db.insert(chatMessagesTable).values({
    sessionId: id,
    role: "user",
    content: body.content,
    crisisFlag: crisis,
  });
  if (crisis) {
    await db.insert(safetyEventsTable).values({
      source: "chat",
      severity: "critical",
      note: `Crisis language detected in chat session ${id}`,
    });
  }

  let systemPrompt: string;
  if (session.mode === "continuing-bonds") {
    let deceased = null;
    if (session.deceasedId) {
      const [d] = await db.select().from(deceasedTable).where(eq(deceasedTable.id, session.deceasedId));
      deceased = d ?? null;
    }
    systemPrompt = continuingBondsSystemPrompt(deceased);
  } else {
    systemPrompt = meaningSystemPrompt();
  }

  const history = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(asc(chatMessagesTable.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (e: object) => res.write(`data: ${JSON.stringify(e)}\n\n`);

  if (crisis) {
    send({ type: "crisis" });
  }

  try {
    let assistant = "";
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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
  } catch (err) {
    req.log.error({ err }, "chat stream error");
    send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
  } finally {
    res.end();
  }
});

export default router;
