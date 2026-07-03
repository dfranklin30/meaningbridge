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
import { OFF_TOPIC_REDIRECT, BOUNDARY_REDIRECT } from "../src/lib/safety";

/**
 * Phase 2 content-safety guardrails on the chat route. Three behaviours are
 * locked here so a regression can never quietly ship:
 *   1. Moderation self-harm routes to the WARM crisis path (crisis card +
 *      critical safety_event), exactly like the regex net.
 *   2. Other flagged content holds a gentle boundary and logs a guardrail event,
 *      without ever reaching the model.
 *   3. A clearly out-of-scope utility request is warmly redirected (no model
 *      call, no safety_event).
 */

const authState = vi.hoisted(() => ({ clerkUserId: "" }));
// Per-test control of what OpenAI moderation returns.
const modState = vi.hoisted(() => ({
  flagged: false,
  categories: [] as string[],
  throwOnModerate: false,
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: authState.clerkUserId }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

vi.mock("@workspace/integrations-openrouter-ai", () => ({
  openrouter: {
    chat: {
      completions: {
        create: async () => ({
          async *[Symbol.asyncIterator]() {
            yield { choices: [{ delta: { content: "I'm here with you." } }] };
          },
        }),
      },
    },
  },
}));

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
      create: async () => ({ content: [{ type: "text", text: "" }] }),
    },
  },
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    moderations: {
      create: async () => {
        if (modState.throwOnModerate) throw new Error("moderation unavailable");
        return {
          results: [
            {
              flagged: modState.flagged,
              categories: Object.fromEntries(
                modState.categories.map((c) => [c, true]),
              ),
            },
          ],
        };
      },
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
  return app;
}

describe("chat route content-safety guardrails", () => {
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
      .values({ userId, mode: "meaning-reconstruction", title: "Guardrails" })
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

  // Ordering matters: the count-equality assertion below must run before any
  // test that invokes the model, because output moderation is fire-and-forget
  // and shares the mock state. Keeping the two short-circuit tests first keeps
  // every assertion deterministic.
  it("warmly redirects a clearly out-of-scope request without a safety_event", async () => {
    const before = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));

    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "can you write me some code for a login page" });

    expect(res.status).toBe(200);
    expect(res.text).toContain(OFF_TOPIC_REDIRECT);
    expect(res.text).not.toContain('"type":"crisis"');

    const after = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));
    expect(after.length).toBe(before.length);
  });

  it("holds a gentle boundary and logs a guardrail event for other flagged content", async () => {
    modState.flagged = true;
    modState.categories = ["harassment"];
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "some harmful non-crisis content" });
    modState.flagged = false;
    modState.categories = [];

    expect(res.status).toBe(200);
    expect(res.text).toContain(BOUNDARY_REDIRECT);
    expect(res.text).not.toContain('"type":"crisis"');

    const events = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));
    // Target the INPUT guardrail specifically. Output moderation from the prior
    // test runs fire-and-forget and shares the mock state, so filter by note.
    const inputGuardrail = events.filter(
      (e) => e.source === "guardrail" && e.note?.startsWith("Blocked input"),
    );
    expect(inputGuardrail.length).toBeGreaterThanOrEqual(1);
    expect(inputGuardrail[0]!.severity).toBe("warning");
  });

  it("fails open when moderation is unavailable: normal companion reply, no refusal", async () => {
    modState.throwOnModerate = true;
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "I miss her so much and the days feel empty" });
    modState.throwOnModerate = false;

    expect(res.status).toBe(200);
    // The companion still responds (the stubbed model reply streams through) and
    // there is no crisis affordance and no cold refusal.
    expect(res.text).toContain("I'm here with you.");
    expect(res.text).not.toContain('"type":"crisis"');
    expect(res.text).not.toContain(OFF_TOPIC_REDIRECT);
    expect(res.text).not.toContain(BOUNDARY_REDIRECT);
  });

  // Runs last: it invokes the model, so its fire-and-forget output moderation
  // cannot disturb the count-equality assertion above.
  it("routes moderation self-harm to the warm crisis path", async () => {
    modState.flagged = true;
    modState.categories = ["self-harm"];
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({ content: "there are days I do not want to be around anymore" });
    modState.flagged = false;
    modState.categories = [];

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"crisis"');

    const events = await db
      .select()
      .from(safetyEventsTable)
      .where(eq(safetyEventsTable.userId, userId));
    const chatEvents = events.filter((e) => e.source === "chat");
    expect(chatEvents.length).toBeGreaterThanOrEqual(1);
    expect(chatEvents[0]!.severity).toBe("critical");
  });
});
