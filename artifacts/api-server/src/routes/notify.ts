import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notifyOptInsTable } from "@workspace/db";
import { CreateNotifyOptInBody } from "@workspace/api-zod";
import { isMailerConfigured, sendMail } from "../lib/mailer";

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
  const roleInterest = body.roleInterest?.trim() || null;
  const source = body.source?.trim() || "qr";

  const inserted = await db
    .insert(notifyOptInsTable)
    .values({ email, roleInterest, source })
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

  const signup = inserted[0];

  // Fire-and-forget the email so the response is never blocked on SMTP.
  if (isMailerConfigured()) {
    const subject = `MeaningBridge signup — ${email}`;
    const lines = [
      "A new person signed up to be notified when MeaningBridge launches.",
      "",
      `Email:   ${email}`,
      `Role:    ${roleInterest ?? "—"}`,
      `Source:  ${source}`,
      `Time:    ${signup.createdAt.toISOString()}`,
      "",
      "This is an automated notification from MeaningBridge.",
    ];
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1f2937;line-height:1.6;max-width:520px;">
        <p>A new person signed up to be notified when MeaningBridge launches.</p>
        <table style="border-collapse:collapse;margin-top:12px;">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Role</td><td style="padding:4px 0;">${roleInterest ?? "&mdash;"}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Source</td><td style="padding:4px 0;">${source}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Time</td><td style="padding:4px 0;">${signup.createdAt.toISOString()}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Automated notification from MeaningBridge.</p>
      </div>
    `;
    sendMail({
      to: NOTIFY_RECIPIENTS,
      cc: NOTIFY_CC,
      subject,
      text: lines.join("\n"),
      html,
      replyTo: email,
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
            "notify signup email sent",
          );
        } else {
          req.log.warn(
            { signupId: signup.id, error: r.error },
            "notify signup email failed",
          );
        }
      })
      .catch((err) => {
        req.log.error({ err: String(err), signupId: signup.id }, "notify signup email threw");
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
