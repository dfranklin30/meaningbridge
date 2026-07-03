import { readFileSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { ShareDeckBody } from "@workspace/api-zod";
import { sendMail, type MailAttachment } from "../lib/mailer";

// Load the overview deck (PDF) and brand logo once at startup.
let DECK_BUFFER: Buffer | null = null;
try {
  DECK_BUFFER = readFileSync(
    path.resolve(process.cwd(), "assets/meaningbridge-deck.pdf"),
  );
} catch {
  DECK_BUFFER = null;
}

let LOGO_BUFFER: Buffer | null = null;
try {
  LOGO_BUFFER = readFileSync(path.resolve(process.cwd(), "assets/logo.png"));
} catch {
  LOGO_BUFFER = null;
}
const LOGO_CID = "meaningbridge-logo";
const DECK_FILENAME = "MeaningBridge-Overview.pdf";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Simple in-memory rate limiting. This endpoint is public and sends email to a
// caller-supplied address, so it is throttled per source IP (burst control) and
// per recipient (anti email-bombing). State resets on restart, which is fine for
// a single-instance abuse guard.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = 8;
const MAX_PER_RECIPIENT = 3;
const ipHits = new Map<string, number[]>();
const recipientHits = new Map<string, number[]>();

const withinLimit = (
  store: Map<string, number[]>,
  key: string,
  max: number,
  now: number,
): boolean => {
  const recent = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
};

const router: IRouter = Router();

router.post("/share", async (req, res) => {
  const body = ShareDeckBody.parse(req.body);
  const email = body.email.trim().toLowerCase();

  const now = Date.now();
  const ip = req.ip ?? "unknown";
  if (!withinLimit(ipHits, ip, MAX_PER_IP, now)) {
    req.log.warn({ ip }, "deck share rate limited (per-ip)");
    res.status(429).json({ ok: false, sent: false });
    return;
  }
  if (!withinLimit(recipientHits, email, MAX_PER_RECIPIENT, now)) {
    req.log.warn("deck share rate limited (per-recipient)");
    res.status(429).json({ ok: false, sent: false });
    return;
  }
  const firstNameRaw = body.firstName?.trim() || null;
  const firstName = firstNameRaw ? firstNameRaw.split(/\s+/)[0]! : null;

  if (!DECK_BUFFER) {
    req.log.error("deck share requested but overview PDF is not available");
    res.status(503).json({ ok: false, sent: false });
    return;
  }

  const attachments: MailAttachment[] = [
    {
      filename: DECK_FILENAME,
      content: DECK_BUFFER,
      contentType: "application/pdf",
    },
  ];
  if (LOGO_BUFFER) {
    attachments.push({
      filename: "meaningbridge-logo.png",
      content: LOGO_BUFFER,
      cid: LOGO_CID,
      contentType: "image/png",
    });
  }

  const greeting = firstName ? `Hello ${escapeHtml(firstName)},` : "Hello,";
  const logoBlock = LOGO_BUFFER
    ? `<img src="cid:${LOGO_CID}" alt="MeaningBridge" height="48" style="height:48px;width:auto;display:block;margin:0 auto 22px;" />`
    : "";

  const text = [
    firstName ? `Hello ${firstName},` : "Hello,",
    "",
    "Here is a short overview of MeaningBridge — a warm, science-grounded companion for grief, built around Dr. Robert Neimeyer's continuing-bonds and meaning-reconstruction approach.",
    "",
    "The overview is attached as a PDF. Take your time with it.",
    "",
    "With care,",
    "The MeaningBridge team",
    "neimeyer@portlandinstitute.org",
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;color:#1f2d3a;max-width:520px;margin:0 auto;padding:8px 4px;">
      ${logoBlock}
      <p style="font-size:16px;line-height:1.6;">${greeting}</p>
      <p style="font-size:16px;line-height:1.6;">
        Here is a short overview of <strong>MeaningBridge</strong> — a warm, science-grounded
        companion for grief, built around Dr. Robert Neimeyer's continuing-bonds and
        meaning-reconstruction approach.
      </p>
      <p style="font-size:16px;line-height:1.6;">
        The overview is attached as a PDF. Take your time with it.
      </p>
      <p style="font-size:16px;line-height:1.6;margin-top:26px;">
        With care,<br />The MeaningBridge team<br />
        <a href="mailto:neimeyer@portlandinstitute.org" style="color:#2a8a86;">neimeyer@portlandinstitute.org</a>
      </p>
    </div>
  `;

  const result = await sendMail({
    to: [email],
    subject: "An overview of MeaningBridge",
    text,
    html,
    replyTo: "neimeyer@portlandinstitute.org",
    attachments,
  });

  if (!result.sent) {
    req.log.warn({ error: result.error }, "deck share email failed");
    res.status(502).json({ ok: false, sent: false });
    return;
  }

  res.status(200).json({ ok: true, sent: true });
});

export default router;
