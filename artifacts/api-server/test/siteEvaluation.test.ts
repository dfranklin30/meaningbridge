import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import { db, pool, sandboxFeedbackTable } from "@workspace/db";

/**
 * Guards the /evaluate save contract on the server side: a POST /feedback with
 * source "site-eval" must persist the flexible ratings/comments jsonb maps and
 * additionalSuggestions exactly as sent, and the "untouched = skipped" behavior
 * (empty maps -> null) must hold. Submission is fire-and-forget on the email
 * side, so without this a regression that dropped the ratings would be silent.
 *
 * The mailer is mocked so no SMTP is attempted; we assert only the DB write.
 */

vi.mock("../src/lib/mailer", () => ({
  isMailerConfigured: () => false,
  sendMail: async () => ({ sent: false, error: "mocked" }),
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

describe("POST /feedback persists site evaluations", () => {
  const createdIds: number[] = [];
  const app = makeApp();
  let ready: Promise<void>;

  ready = (async () => {
    const feedbackRouter = (await import("../src/routes/feedback")).default;
    app.use(feedbackRouter);
  })();

  afterAll(async () => {
    for (const id of createdIds) {
      await db.delete(sandboxFeedbackTable).where(eq(sandboxFeedbackTable.id, id));
    }
    await pool.end();
  });

  it("stores ratings/comments/additionalSuggestions jsonb and consent for source site-eval", async () => {
    await ready;
    const res = await request(app)
      .post("/feedback")
      .send({
        role: null,
        ratings: { navigation: 8, aesthetics: 3 },
        comments: { navigation: "Easy to move around" },
        additionalSuggestions: "Please add a dark mode",
        consentToShare: true,
        source: "site-eval",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const id = res.body.feedback.id as number;
    createdIds.push(id);

    const [row] = await db
      .select()
      .from(sandboxFeedbackTable)
      .where(eq(sandboxFeedbackTable.id, id));

    expect(row).toBeDefined();
    expect(row!.source).toBe("site-eval");
    expect(row!.ratings).toEqual({ navigation: 8, aesthetics: 3 });
    expect(row!.comments).toEqual({ navigation: "Easy to move around" });
    expect(row!.additionalSuggestions).toBe("Please add a dark mode");
    expect(row!.consentToShare).toBe(true);
  });

  it("collapses empty ratings/comments maps to null (untouched = skipped)", async () => {
    await ready;
    const res = await request(app)
      .post("/feedback")
      .send({
        ratings: {},
        comments: {},
        additionalSuggestions: "Just a note, no ratings",
        source: "site-eval",
      });

    expect(res.status).toBe(200);
    const id = res.body.feedback.id as number;
    createdIds.push(id);

    const [row] = await db
      .select()
      .from(sandboxFeedbackTable)
      .where(eq(sandboxFeedbackTable.id, id));

    expect(row!.ratings).toBeNull();
    expect(row!.comments).toBeNull();
    expect(row!.additionalSuggestions).toBe("Just a note, no ratings");
    expect(row!.consentToShare).toBe(false);
  });
});
