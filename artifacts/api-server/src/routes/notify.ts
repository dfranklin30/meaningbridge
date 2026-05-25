import { readFileSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notifyOptInsTable } from "@workspace/db";
import { CreateNotifyOptInBody } from "@workspace/api-zod";
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

// Escape user-controlled values before interpolating into email HTML.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const router: IRouter = Router();

const NOTIFY_RECIPIENTS = [
  "remcrawfordresearch@gmail.com",
  "danielle@techleadershipcommunity.com",
  "neimeyer@memphis.edu",
];
const NOTIFY_CC = ["neimeyer@portlandinstitute.org"];

router.post("/notify", async (req, res) => {
  const body = CreateNotifyOptInBody.parse(req.body);
  const email = body.email.trim().toLowerCase();
  const firstNameRaw = body.firstName?.trim() || null;
  const firstName = firstNameRaw ? firstNameRaw.split(/\s+/)[0]! : null;
  const roleInterest = body.roleInterest?.trim() || null;
  const source = body.source?.trim() || "qr";

  const inserted = await db
    .insert(notifyOptInsTable)
    .values({ email, firstName, roleInterest, source })
    .onConflictDoNothing({ target: notifyOptInsTable.email })
    .returning();

  if (inserted.length === 0) {
    const [existing] = await db
      .select()
      .from(notifyOptInsTable)
      .where(eq(notifyOptInsTable.email, email));
    res.json({ ok: true, alreadySubscribed: true, signup: existing });
    return;
  }

  const signup = inserted[0]!;
  const greetingName = signup.firstName || firstName;
  const safeEmail = escapeHtml(email);
  const safeGreetingName = greetingName ? escapeHtml(greetingName) : null;
  const safeRole = roleInterest ? escapeHtml(roleInterest) : null;
  const safeSource = escapeHtml(source);

  // Fire-and-forget both emails so the response is never blocked on SMTP.
  if (isMailerConfigured()) {
    // 1) Internal notification to the team.
    const internalSubject = `MeaningBridge signup — ${email}`;
    const internalLines = [
      "A new person signed up to be notified when MeaningBridge launches.",
      "",
      `Name:    ${greetingName ?? "—"}`,
      `Email:   ${email}`,
      `Role:    ${roleInterest ?? "—"}`,
      `Source:  ${source}`,
      `Time:    ${signup.createdAt.toISOString()}`,
      "",
      "This is an automated notification from MeaningBridge.",
    ];
    const internalHtml = `
      <div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:28px 24px;background:#fbf6ec;border-radius:12px;">
        ${logoBlock()}
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1f3a68;text-align:center;margin:0 0 18px;">A new person signed up for MeaningBridge.</p>
        <table style="border-collapse:collapse;margin:18px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;">${safeGreetingName ?? "&mdash;"}</td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:${safeEmail}" style="color:#1f3a68;">${safeEmail}</a></td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Role</td><td style="padding:6px 0;">${safeRole ?? "&mdash;"}</td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Source</td><td style="padding:6px 0;">${safeSource}</td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;">${signup.createdAt.toISOString()}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Automated notification from MeaningBridge. Reply to this message to write back to the new signup directly.</p>
      </div>
    `;
    sendMail({
      to: NOTIFY_RECIPIENTS,
      cc: NOTIFY_CC,
      subject: internalSubject,
      text: internalLines.join("\n"),
      html: internalHtml,
      replyTo: email,
      attachments: logoAttachments(),
    })
      .then((r) => {
        if (r.sent) {
          req.log.info(
            {
              signupId: signup.id,
              messageId: r.messageId,
              recipients: NOTIFY_RECIPIENTS.length,
              cc: NOTIFY_CC.length,
            },
            "notify signup internal email sent",
          );
        } else {
          req.log.warn(
            { signupId: signup.id, error: r.error },
            "notify signup internal email failed",
          );
        }
      })
      .catch((err) => {
        req.log.error({ err: String(err), signupId: signup.id }, "notify signup internal email threw");
      });

    // 2) Confirmation email to the signup themselves.
    const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
    const safeGreeting = safeGreetingName ? `Hello ${safeGreetingName},` : "Hello,";
    const confirmSubject = "You are on the list for MeaningBridge";
    const confirmText = [
      greeting,
      "",
      "Thank you for signing up. You are on the list, and we will write to you the day MeaningBridge opens its doors.",
      "",
      "MeaningBridge is a warm, AI-assisted grief companion grounded in Dr. Robert Neimeyer's meaning-oriented, continuing-bonds approach. It is a quiet place between sessions — designed to sit beside the people and clinicians you already trust, never in front of them.",
      "",
      "When you join, the experience will be shaped around you and the person you are remembering. Your story, your pace.",
      "",
      "With care,",
      "The MeaningBridge team",
      "",
      "Brought to you by Dr. Robert Neimeyer and the Portland Institute for Loss and Transition.",
      "Questions: neimeyer@portlandinstitute.org",
    ].join("\n");
    const confirmHtml = `
      <div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.7;max-width:560px;margin:0 auto;padding:32px 28px;background:#fbf6ec;border-radius:14px;">
        ${logoBlock()}
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1f3a68;text-align:center;margin:0 0 24px;">You are on the list.</p>
        <p style="margin:0 0 18px;">${safeGreeting}</p>
        <p style="margin:0 0 18px;">Thank you for signing up. We will write to you the day MeaningBridge opens its doors.</p>
        <p style="margin:0 0 18px;">MeaningBridge is a warm, AI-assisted grief companion grounded in Dr. Robert Neimeyer's meaning-oriented, continuing-bonds approach. It is a quiet place between sessions, designed to sit beside the people and clinicians you already trust, never in front of them.</p>
        <p style="margin:0 0 18px;">When you join, the experience will be shaped around you and the person you are remembering. Your story, your pace.</p>
        <p style="margin:24px 0 0;">With care,<br/><span style="color:#1f3a68;">The MeaningBridge team</span></p>
        <p style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e1d5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
          Brought to you by Dr. Robert Neimeyer and the Portland Institute for Loss and Transition.<br/>
          Questions? Reach us at <a href="mailto:neimeyer@portlandinstitute.org" style="color:#1f3a68;">neimeyer@portlandinstitute.org</a>.
        </p>
      </div>
    `;
    sendMail({
      to: [email],
      subject: confirmSubject,
      text: confirmText,
      html: confirmHtml,
      replyTo: "neimeyer@portlandinstitute.org",
      attachments: logoAttachments(),
    })
      .then((r) => {
        if (r.sent) {
          req.log.info(
            { signupId: signup.id, messageId: r.messageId, to: email },
            "notify signup confirmation email sent",
          );
        } else {
          req.log.warn(
            { signupId: signup.id, error: r.error, to: email },
            "notify signup confirmation email failed",
          );
        }
      })
      .catch((err) => {
        req.log.error(
          { err: String(err), signupId: signup.id, to: email },
          "notify signup confirmation email threw",
        );
      });
  } else {
    req.log.info(
      { signupId: signup.id, source, recipients: NOTIFY_RECIPIENTS, cc: NOTIFY_CC },
      "notify signup recorded (mailer not configured)",
    );
  }

  res.json({ ok: true, alreadySubscribed: false, signup });
});

router.get("/notify", async (req, res) => {
  const adminToken = process.env["NOTIFY_ADMIN_TOKEN"];
  if (!adminToken) {
    req.log.warn("GET /notify denied: NOTIFY_ADMIN_TOKEN not configured");
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
    .from(notifyOptInsTable)
    .orderBy(desc(notifyOptInsTable.createdAt));
  res.json(rows);
});

export default router;
