import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import {
  db,
  pool,
  usersTable,
  chatSessionsTable,
  chatMessagesTable,
  safetyEventsTable,
} from "@workspace/db";
import { detectCrisis } from "../src/lib/crisis";
import { gisSafetySignal, GIS_CLINICAL_CUTPOINT, tierFromGisScore } from "../src/lib/clinical";

/**
 * Crisis-support safety net. The single most safety-critical path in the app:
 * every user message is screened, a match must log a `safety_event` AND surface
 * the calm crisis affordance, and the structured GIS escalation contract must
 * fire regardless of the numeric total. These tests lock all three in so a
 * silent regression (a phrase that stops matching, or a match that fails to
 * log) can never ship unnoticed.
 *
 * The chat route is exercised end-to-end against the real dev database with a
 * stubbed session (Clerk auth) and a stubbed Anthropic stream, so the assertion
 * is about MeaningBridge's own detect -> log -> stream contract, not the LLM.
 */

// Hoisted so the vi.mock factories (which are hoisted above imports) can read
// the currently-signed-in Clerk user chosen per test run.
const authState = vi.hoisted(() => ({ clerkUserId: "" }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: authState.clerkUserId }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

// Stub Anthropic so the route's streaming step is deterministic and offline.
// The crisis affordance + safety_event are written BEFORE the model is called,
// so this stub never influences what we assert.
vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      stream: async () => ({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "I'm here with you." },
          };
        },
      }),
      // Fire-and-forget memory extraction calls this; keep it harmless.
      create: async () => ({ content: [{ type: "text", text: "" }] }),
    },
  },
}));

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    };
    next();
  });
  app.use(express.json());
  // Import lazily AFTER mocks are registered.
  return app;
}

async function collectSse(res: request.Response): Promise<string> {
  return res.text ?? "";
}

describe("crisis phrase detection (detectCrisis)", () => {
  it("flags explicit crisis language across the covered patterns", () => {
    const crisisMessages = [
      "I want to die and be with her again",
      "sometimes I think about how to kill myself",
      "I feel suicidal since he passed",
      "everyone would be better off without me",
      "I just want to end my life",
      "I can't go on anymore",
      "there is no reason to live now",
      "I keep hurting myself to feel something",
      "I've been thinking about self-harm",
    ];
    for (const msg of crisisMessages) {
      expect(detectCrisis(msg), `should flag: "${msg}"`).toBe(true);
    }
  });

  it("does NOT flag ordinary, painful-but-safe grief language", () => {
    const griefMessages = [
      "I miss her so much it hurts",
      "I feel so lost without him",
      "The grief comes in waves and I cry every day",
      "I don't know how to live in a world without my mom",
      "I feel empty and alone since the funeral",
      "I keep expecting him to walk through the door",
      "Some days I can barely get out of bed",
    ];
    for (const msg of griefMessages) {
      expect(detectCrisis(msg), `should NOT flag: "${msg}"`).toBe(false);
    }
  });
});

describe("chat route crisis contract (detect -> log safety_event -> stream affordance)", () => {
  const app = makeApp();
  let userId = 0;
  let sessionId = 0;

  beforeAll(async () => {
    authState.clerkUserId = `test_${randomUUID()}`;
    const [user] = await db
      .insert(usersTable)
      .values({ clerkUserId: authState.clerkUserId, role: "seeker" })
      .returning();
    userId = user!.id;

    const [session] = await db
      .insert(chatSessionsTable)
      .values({ userId, mode: "meaning-reconstruction", title: "Test session" })
      .returning();
    sessionId = session!.id;

    const chatRouter = (await import("../src/routes/chat")).default;
    app.use("/chat", chatRouter);
  });

  afterAll(async () => {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId));
    await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId));
    await db.delete(safetyEventsTable).where(eq(safetyEventsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await pool.end();
  });

  it("logs a safety_event and streams the crisis affordance for crisis language", async () => {
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "I want to die, I can't go on without her" });

    expect(res.status).toBe(200);
    const body = await collectSse(res);
    // The calm crisis card is driven by this SSE frame.
    expect(body).toContain('"type":"crisis"');

    // A critical safety_event is persisted for this user, sourced from chat.
    const events = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));
    const chatEvents = events.filter((e) => e.source === "chat");
    expect(chatEvents.length).toBeGreaterThanOrEqual(1);
    expect(chatEvents[0]!.severity).toBe("critical");

    // The stored user message is flagged too.
    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId));
    const flagged = msgs.filter((m) => m.role === "user" && m.crisisFlag === true);
    expect(flagged.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT log a safety_event or stream the affordance for ordinary grief language", async () => {
    const beforeEvents = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));

    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "I miss her so much and the days feel empty" });

    expect(res.status).toBe(200);
    const body = await collectSse(res);
    expect(body).not.toContain('"type":"crisis"');

    const afterEvents = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));
    expect(afterEvents.length).toBe(beforeEvents.length);
  });
});

describe("GIS structured escalation runs regardless of total (item-3/item-5 contract)", () => {
  it("flags item 3 >= 2 even when the total is well below the clinical cut-score", () => {
    // Total = 2, far under the clinical cut-score, but self-destructive coping
    // must still escalate to the safety layer.
    const responses = { 1: 0, 2: 0, 3: 2, 4: 0, 5: 0 };
    const total = Object.values(responses).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(GIS_CLINICAL_CUTPOINT);
    expect(tierFromGisScore(total)).toBe("universal");

    const signal = gisSafetySignal(responses);
    expect(signal.flag).toBe(true);
    expect(signal.triggers).toContain("item3");
  });

  it("flags item 5 >= 3 even when the total is well below the clinical cut-score", () => {
    const responses = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 3 };
    const total = Object.values(responses).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(GIS_CLINICAL_CUTPOINT);

    const signal = gisSafetySignal(responses);
    expect(signal.flag).toBe(true);
    expect(signal.triggers).toContain("item5");
  });

  it("does NOT escalate when the safety items sit below their thresholds", () => {
    // A high-but-sub-trigger profile: item3 = 1 and item5 = 2 are below the
    // structured thresholds, so no safety signal fires even at a targeted total.
    const responses = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 2 };
    const signal = gisSafetySignal(responses);
    expect(signal.flag).toBe(false);
    expect(signal.triggers).toHaveLength(0);
  });
});
