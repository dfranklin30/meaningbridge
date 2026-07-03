import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { db, pool, usersTable } from "@workspace/db";

/**
 * Regression guard for the API body-size limit as wired in the *real* app
 * (`src/app.ts`), not a hand-rolled test app. Companion image-chat sends base64
 * images inside the JSON body; Express's default `express.json()` limit is
 * 100 kb, which would reject realistic image payloads at the body parser before
 * the chat route ever runs (the route's own validation would then be dead code).
 * This posts a >100 kb payload and asserts it passes the parser and reaches the
 * chat route (a missing session yields 404), rather than being rejected up front
 * (which the app's error handler surfaces as a 500).
 */

const authState = vi.hoisted(() => ({ clerkUserId: "" }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: authState.clerkUserId }),
  clerkClient: { users: { getUser: async () => ({}) } },
  // The app installs clerkMiddleware globally; a passthrough keeps the real
  // middleware chain intact without needing Clerk keys.
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

// Keep the route-import chain harmless: the chat route pulls in the Anthropic
// integration at module load, and we never want a real network client here.
vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      stream: async () => ({
        async *[Symbol.asyncIterator]() {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "ok" },
          };
        },
      }),
      create: async () => ({ content: [{ type: "text", text: "" }] }),
    },
  },
}));

const { default: app } = await import("../src/app");

describe("real app body-size limit accommodates image-chat payloads", () => {
  beforeAll(() => {
    authState.clerkUserId = `test_${randomUUID()}`;
  });

  afterAll(async () => {
    // requireAuth just-in-time provisions a users row for the mocked identity.
    await db.delete(usersTable).where(eq(usersTable.clerkUserId, authState.clerkUserId));
    await pool.end();
  });

  it("accepts a >100 kb image payload and reaches the chat route (404), not a parser rejection", async () => {
    // ~200 kb of base64 -> the whole JSON body comfortably exceeds Express's
    // default 100 kb limit, so this only succeeds if the app raised the limit.
    const base64 = Buffer.alloc(200 * 1024, 0).toString("base64");
    const res = await request(app)
      // A session id that does not exist: reaching this route at all proves the
      // body parser accepted the large payload.
      .post("/api/chat/sessions/999999999/messages")
      .send({
        content: "A photo of us",
        images: [`data:image/png;base64,${base64}`],
      });

    // Reached the route (session missing) rather than being rejected by the body
    // parser (which the error handler would surface as 500).
    expect(res.status).toBe(404);
  });
});
