import { readFileSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notifyOptInsTable } from "@workspace/db";
import { CreateNotifyOptInBody } from "@workspace/api-zod";
import { isMailerConfigured, sendMail } from "../lib/mailer";

// Load brand logo once at startup for inline email embedding.
let LOGO_BUFFER: Buffer | null = null;
try {
  LOGO_BUFFER = readFileSync(path.resolve(process.cwd(), "assets/logo.png"));
} catch {
  LOGO_BUFFER = null;
}
const LOGO_CID = "meaningbridge-logo";

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
    const logoBlock = LOGO_BUFFER
      ? `<img src="cid:${LOGO_CID}" alt="MeaningBridge" height="44" style="height:44px;width:auto;display:block;margin:0 auto 18px;" />`
      : "";
    const html = `
      <div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.6;max-width:560px;margin:0 auto;padding:28px 24px;background:#fbf6ec;border-radius:12px;">
        ${logoBlock}
        <p style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1f3a68;text-align:center;margin:0 0 18px;">A new person signed up for MeaningBridge.</p>
        <table style="border-collapse:collapse;margin:18px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}" style="color:#1f3a68;">${email}</a></td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Role</td><td style="padding:6px 0;">${roleInterest ?? "&mdash;"}</td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Source</td><td style="padding:6px 0;">${source}</td></tr>
          <tr><td style="padding:6px 14px 6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;">${signup.createdAt.toISOString()}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Automated notification from MeaningBridge. Reply to this message to write back to the new signup directly.</p>
      </div>
    `;
    sendMail({
      to: NOTIFY_RECIPIENTS,
      cc: NOTIFY_CC,
      subject,
      text: lines.join("\n"),
      html,
      replyTo: email,
      attachments: LOGO_BUFFER
        ? [
            {
              filename: "meaningbridge-logo.png",
              content: LOGO_BUFFER,
              cid: LOGO_CID,
              contentType: "image/png",
            },
          ]
        : undefined,
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
