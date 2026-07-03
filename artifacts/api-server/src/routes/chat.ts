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
import {
  CreateChatSessionBody,
  GetChatSessionParams,
  SendChatMessageBody,
} from "@workspace/api-zod";
import { companionStream, parseImages, type ChatTurn } from "../lib/aiProvider";
import { detectCrisis } from "../lib/crisis";
import {
  moderate,
  classifyTopic,
  OFF_TOPIC_REDIRECT,
  BOUNDARY_REDIRECT,
} from "../lib/safety";
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

  // Safety layer: the regex net catches explicit phrasing; moderation catches
  // self-harm the regex misses. Either one routes to the warm crisis path.
  const moderation = await moderate(body.content);
  const crisis = detectCrisis(body.content) || moderation.selfHarm;
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

  // Stream a fixed, on-brand reply (no model call), persist it, and close the
  // stream. Used by the guardrail short-circuits below.
  const streamCannedReply = async (message: string) => {
    send({ type: "delta", text: message });
    await db.insert(chatMessagesTable).values({
      sessionId: id,
      role: "assistant",
      content: message,
      crisisFlag: false,
    });
    send({ type: "done" });
    res.end();
  };

  if (crisis) {
    // Crisis stays on the warm path: surface the calm affordance AND let the
    // companion respond with care (never a cold cutoff).
    send({ type: "crisis" });
  } else if (moderation.flagged) {
    // Harmful content that is not self-harm: log a guardrail event and hold a
    // gentle boundary rather than passing it to the model.
    await db.insert(safetyEventsTable).values({
      userId: req.userId!,
      source: "guardrail",
      severity: "warning",
      note: `Blocked input categories: ${moderation.categories.join(", ")}`,
    });
    await streamCannedReply(BOUNDARY_REDIRECT);
    return;
  } else if (classifyTopic(body.content) === "off_topic") {
    // Clearly out-of-scope utility request: warmly redirect, no model call.
    // Deliberately NOT a safety_event — off-topic is benign, and the safety feed
    // (the user's settings view and the clinician-facing safety counts/nudges)
    // must not be polluted with non-safety noise. Logged for observability only.
    req.log.info(
      { guardrail: "off_topic_redirect", sessionId: id },
      "off-topic request redirected",
    );
    await streamCannedReply(OFF_TOPIC_REDIRECT);
    return;
  }

  // Vision: the user may attach one or more base64 image data URLs alongside
  // the newest message. Images are not persisted (companion is ephemeral); they
  // are only injected into the final user turn for this single request.
  const images = parseImages(body.images);

  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    let assistant = "";
    for await (const delta of companionStream({
      system: systemPrompt,
      history: turns,
      images,
    })) {
      assistant += delta;
      send({ type: "delta", text: delta });
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
    // Fire-and-forget output guardrail: moderate what the model produced and log
    // a guardrail event if anything slipped through. Never blocks the response.
    void moderate(assistant)
      .then((m) => {
        if (!m.flagged) return;
        return db.insert(safetyEventsTable).values({
          userId: req.userId!,
          source: "guardrail",
          severity: m.selfHarm ? "critical" : "warning",
          note: `Model output flagged: ${m.categories.join(", ")}`,
        });
      })
      .catch((err) => req.log.error({ err }, "output moderation failed"));
  } catch (err) {
    req.log.error({ err }, "chat stream error");
    send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
  } finally {
    res.end();
  }
});

export default router;
