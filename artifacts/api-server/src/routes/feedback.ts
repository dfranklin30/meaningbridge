import { readFileSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, sandboxFeedbackTable } from "@workspace/db";
import { CreateSandboxFeedbackBody } from "@workspace/api-zod";
import { isMailerConfigured, sendMail, type MailAttachment } from "../lib/mailer";

// Load brand logo once at startup for inline email embedding.
let LOGO_BUFFER: Buffer | null = null;
try {
  LOGO_BUFFER = readFileSync(path.resolve(process.cwd(), "assets/logo.png"));
} catch {
  LOGO_BUFFER = null;
}
const LOGO_CID = "meaningbridge-logo";

const logoAttachments = (): MailAttachment[] | undefined =>
  LOGO_BUFFER
    ? [
        {
          filename: "meaningbridge-logo.png",
          content: LOGO_BUFFER,
          cid: LOGO_CID,
          contentType: "image/png",
        },
      ]
    : undefined;

const logoBlock = (): string =>
  LOGO_BUFFER
    ? `<img src="cid:${LOGO_CID}" alt="MeaningBridge" height="48" style="height:48px;width:auto;display:block;margin:0 auto 22px;" />`
    : "";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const FEEDBACK_RECIPIENTS = [
  "remcrawfordresearch@gmail.com",
  "danielle@techleadershipcommunity.com",
];
const FEEDBACK_CC = ["neimeyer@portlandinstitute.org"];

const ratingLabel = (n: number | null | undefined): string =>
  n == null ? "\u2014" : `${n} of 5`;

const router: IRouter = Router();

router.post("/feedback", async (req, res) => {
  const body = CreateSandboxFeedbackBody.parse(req.body);

  const role = body.role?.trim() || null;
  const narrative = body.narrative?.trim() || null;
  const name = body.name?.trim() || null;
  const roleLabel = body.roleLabel?.trim() || null;
  const source = body.source?.trim() || "sandbox";
  const consentToShare = body.consentToShare ?? false;

  const [feedback] = await db
    .insert(sandboxFeedbackTable)
    .values({
      role,
      navigationRating: body.navigationRating ?? null,
      aestheticsRating: body.aestheticsRating ?? null,
      helpfulnessRating: body.helpfulnessRating ?? null,
      overallRating: body.overallRating ?? null,
      narrative,
      name,
      roleLabel,
      consentToShare,
      source,
    })
    .returning();

  if (!feedback) {
    res.status(500).json({ error: "Could not record feedback." });
    return;
  }

  // Fire-and-forget internal notification so the response is never blocked on SMTP.
  if (isMailerConfigured()) {
    const safeNarrative = narrative ? escapeHtml(narrative) : null;
    const safeName = name ? escapeHtml(name) : null;
    const safeRoleLabel = roleLabel ? escapeHtml(roleLabel) : null;
    const subject = `MeaningBridge sandbox feedback${role ? ` — ${role}` : ""}`;
    const textLines = [
      "New sandbox feedback was submitted.",
      "",
      `Experienced as:   ${role ?? "\u2014"}`,
      `Ease of navigation: ${ratingLabel(body.navigationRating)}`,
      `Aesthetics:         ${ratingLabel(body.aestheticsRating)}`,
      `Perceived help:     ${ratingLabel(body.helpfulnessRating)}`,
      `Overall:            ${ratingLabel(body.overallRating)}`,
      "",
      `Name:    ${name ?? "\u2014"}`,
      `Role:    ${roleLabel ?? "\u2014"}`,
      `May share as testimonial: ${consentToShare ? "yes" : "no"}`,
      "",
      "Narrative:",
      narrative ?? "\u2014",
      "",
      `Time: ${feedback.createdAt.toISOString()}`,
    ];
    const html = `
      <div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:28px 24px;background:#fbf6ec;border-radius:12px;">
        ${logoBlock()}
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1f3a68;text-align:center;margin:0 0 18px;">New sandbox feedback</p>
        <table style="border-collapse:collapse;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Experienced as</td><td style="padding:5px 0;">${escapeHtml(role ?? "\u2014")}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Ease of navigation</td><td style="padding:5px 0;">${ratingLabel(body.navigationRating)}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Aesthetics</td><td style="padding:5px 0;">${ratingLabel(body.aestheticsRating)}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Perceived help</td><td style="padding:5px 0;">${ratingLabel(body.helpfulnessRating)}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Overall</td><td style="padding:5px 0;">${ratingLabel(body.overallRating)}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Name</td><td style="padding:5px 0;">${safeName ?? "&mdash;"}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">Role</td><td style="padding:5px 0;">${safeRoleLabel ?? "&mdash;"}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;color:#6b7280;">May share</td><td style="padding:5px 0;">${consentToShare ? "yes" : "no"}</td></tr>
        </table>
        ${
          safeNarrative
            ? `<p style="margin:18px 0 6px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;">Narrative</p><p style="margin:0;padding:12px 14px;background:#fff;border-radius:8px;border:1px solid #e5e1d5;">${safeNarrative}</p>`
            : ""
        }
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Automated notification from the MeaningBridge sandbox.</p>
      </div>
    `;
    sendMail({
      to: FEEDBACK_RECIPIENTS,
      cc: FEEDBACK_CC,
      subject,
      text: textLines.join("\n"),
      html,
      attachments: logoAttachments(),
    })
      .then((r) => {
        if (r.sent) {
          req.log.info(
            { feedbackId: feedback.id, messageId: r.messageId },
            "sandbox feedback email sent",
          );
        } else {
          req.log.warn(
            { feedbackId: feedback.id, error: r.error },
            "sandbox feedback email failed",
          );
        }
      })
      .catch((err) => {
        req.log.error(
          { err: String(err), feedbackId: feedback.id },
          "sandbox feedback email threw",
        );
      });
  } else {
    req.log.info(
      { feedbackId: feedback.id, source },
      "sandbox feedback recorded (mailer not configured)",
    );
  }

  res.json({ ok: true, feedback });
});

router.get("/feedback", async (req, res) => {
  const adminToken = process.env["NOTIFY_ADMIN_TOKEN"];
  if (!adminToken) {
    req.log.warn("GET /feedback denied: NOTIFY_ADMIN_TOKEN not configured");
    res.status(403).json({ error: "Admin export not enabled." });
    return;
  }
  const provided =
    req.header("x-admin-token") ||
    (req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (provided !== adminToken) {
    res.status(403).json({ error: "Forbidden." });
    return;
  }
  const rows = await db
    .select()
    .from(sandboxFeedbackTable)
    .orderBy(desc(sandboxFeedbackTable.createdAt));
  res.json(rows);
});

export default router;
