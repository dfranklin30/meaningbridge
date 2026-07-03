import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import {
  db,
  pool,
  usersTable,
  chatSessionsTable,
  chatMessagesTable,
} from "@workspace/db";

/**
 * Guards the companion vision contract. Base64 images are only meaningful to
 * the model when (a) unsupported / malformed data URLs are dropped before they
 * reach Anthropic, and (b) valid images are injected into the FINAL user turn
 * only — never into an earlier turn. A silent regression here would either send
 * garbage to the model or silently stop images from reaching it. The route is
 * exercised end-to-end with a stubbed Clerk auth and a stubbed Anthropic stream
 * whose call args we capture and assert against.
 */

const authState = vi.hoisted(() => ({ clerkUserId: "" }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: authState.clerkUserId }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

// Capture the exact args passed to anthropic.messages.stream so we can assert
// on the shape of the final `messages` array the route builds.
const captured = vi.hoisted(() => ({ streamArgs: null as unknown }));

vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      stream: async (args: unknown) => {
        captured.streamArgs = args;
        return {
          async *[Symbol.asyncIterator]() {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "ok" },
            };
          },
        };
      },
      // Fire-and-forget memory extraction calls this; keep it harmless.
      create: async () => ({ content: [{ type: "text", text: "" }] }),
    },
  },
}));

// A 1x1 transparent PNG (valid base64) used as the "good" image.
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type StreamArgs = {
  messages: Array<{
    role: string;
    content:
      | string
      | Array<{ type: string; source?: { media_type: string } }>;
  }>;
};

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
  // Larger limit so base64 image payloads fit in the JSON body.
  app.use(express.json({ limit: "10mb" }));
  return app;
}

describe("chat route image validation + final-turn injection", () => {
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
      .values({ userId, mode: "meaning-reconstruction", title: "Vision test" })
      .returning();
    sessionId = session!.id;

    const chatRouter = (await import("../src/routes/chat")).default;
    app.use("/chat", chatRouter);
  });

  afterAll(async () => {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId));
    await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await pool.end();
  });

  beforeEach(async () => {
    captured.streamArgs = null;
    // Reset the transcript before each case so "final turn" is unambiguous.
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId));
  });

  it("injects a valid image into the final user turn as an image block", async () => {
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "Here is a photo of us",
        images: [`data:image/png;base64,${PNG_1PX}`],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    const last = args.messages[args.messages.length - 1]!;
    expect(last.role).toBe("user");
    expect(Array.isArray(last.content)).toBe(true);
    const blocks = last.content as Array<{ type: string; source?: { media_type: string } }>;
    const imageBlocks = blocks.filter((b) => b.type === "image");
    expect(imageBlocks).toHaveLength(1);
    expect(imageBlocks[0]!.source!.media_type).toBe("image/png");
    // The text block is still present alongside the image.
    expect(blocks.some((b) => b.type === "text")).toBe(true);
  });

  it("drops an unsupported media type so no image block reaches the model", async () => {
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "This should have no image",
        // image/svg+xml is not in the allow-list.
        images: [`data:image/svg+xml;base64,${PNG_1PX}`],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    const last = args.messages[args.messages.length - 1]!;
    // With no valid image, the final turn is a plain text string, not an array.
    expect(typeof last.content).toBe("string");
  });

  it("drops a malformed (non data-URL) image entry", async () => {
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "Malformed image payload",
        images: ["not-a-data-url"],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    const last = args.messages[args.messages.length - 1]!;
    expect(typeof last.content).toBe("string");
  });

  it("drops an oversized image (decoded > 5 MB) even though the client cap is bypassed", async () => {
    // ~6 MB of decoded bytes -> exceeds the server cap. Base64 inflates this to
    // ~8 MB, which still fits inside the route's JSON body limit, so this really
    // exercises the size check rather than the body parser.
    const bigBase64 = Buffer.alloc(6 * 1024 * 1024, 0).toString("base64");
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "Sneaking in a huge image",
        images: [`data:image/png;base64,${bigBase64}`],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    const last = args.messages[args.messages.length - 1]!;
    // The oversized image is dropped, so the final turn stays a plain string.
    expect(typeof last.content).toBe("string");
  });

  it("attaches images only to the final user turn, leaving earlier turns as text", async () => {
    // Seed an earlier text-only user turn + assistant reply so there is history.
    await db.insert(chatMessagesTable).values({
      sessionId,
      role: "user",
      content: "An earlier message",
      crisisFlag: false,
    });
    await db.insert(chatMessagesTable).values({
      sessionId,
      role: "assistant",
      content: "An earlier reply",
      crisisFlag: false,
    });

    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "Now with a photo",
        images: [`data:image/jpeg;base64,${PNG_1PX}`],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    // Earlier turns stay as plain strings; only the last carries an image array.
    const earlier = args.messages.slice(0, -1);
    for (const m of earlier) {
      expect(typeof m.content).toBe("string");
    }
    const last = args.messages[args.messages.length - 1]!;
    expect(Array.isArray(last.content)).toBe(true);
    const blocks = last.content as Array<{ type: string }>;
    expect(blocks.some((b) => b.type === "image")).toBe(true);
  });

  it("sends an image-only final turn (no text block) when content is empty", async () => {
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .send({
        content: "",
        images: [`data:image/webp;base64,${PNG_1PX}`],
      });
    expect(res.status).toBe(200);

    const args = captured.streamArgs as StreamArgs;
    const last = args.messages[args.messages.length - 1]!;
    const blocks = last.content as Array<{ type: string }>;
    expect(blocks.every((b) => b.type === "image")).toBe(true);
    expect(blocks).toHaveLength(1);
  });
});
