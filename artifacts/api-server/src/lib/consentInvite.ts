import { sendMail } from "./mailer";
import { logger } from "./logger";

/**
 * Sends the patient a secure invite link to review a plain-language consent and
 * e-sign before their MeaningBridge account activates. Calm, no emojis, and a
 * real human reply-to (Dr. Neimeyer's institute mailbox), mirroring the notify
 * confirmation email. Fire-and-forget: callers must never block a response on
 * SMTP.
 */
export interface ConsentInviteInput {
  to: string;
  firstName: string | null;
  providerName: string | null;
  token: string;
  origin: string;
}

const REPLY_TO = "neimeyer@portlandinstitute.org";

export async function sendConsentInvite(input: ConsentInviteInput): Promise<void> {
  const link = `${input.origin}/consent/${input.token}`;
  const greeting = input.firstName ? `Hello ${input.firstName},` : "Hello,";
  const who = input.providerName ? input.providerName : "Your clinician";

  const text = [
    greeting,
    "",
    `${who} has invited you to MeaningBridge, a private, gentle companion for meaning-oriented grief support.`,
    "",
    "Before your space is ready, we ask you to read a short, plain-language consent and add your signature. It explains how your information is used, what MeaningBridge can and cannot do, and reminds you that it is a companion alongside — not a replacement for — therapy or emergency care.",
    "",
    "Review and sign here:",
    link,
    "",
    "There is no rush. You can open the link whenever you feel ready.",
    "",
    "With care,",
    "The MeaningBridge team",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #22303f; line-height: 1.6; max-width: 520px;">
      <p>${greeting}</p>
      <p>${escapeHtml(who)} has invited you to <strong>MeaningBridge</strong>, a private, gentle companion for meaning-oriented grief support.</p>
      <p>Before your space is ready, we ask you to read a short, plain-language consent and add your signature. It explains how your information is used, what MeaningBridge can and cannot do, and reminds you that it is a companion alongside &mdash; not a replacement for &mdash; therapy or emergency care.</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background:#2f8a86;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">Review and sign your consent</a>
      </p>
      <p style="color:#5b6b78;font-size:14px;">There is no rush. You can open the link whenever you feel ready.</p>
      <p style="margin-top:28px;">With care,<br/>The MeaningBridge team</p>
    </div>
  `;

  const result = await sendMail({
    to: [input.to],
    subject: "Your invitation to MeaningBridge",
    text,
    html,
    replyTo: REPLY_TO,
  });

  if (!result.sent) {
    logger.warn({ error: result.error }, "consent invite email not sent");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
