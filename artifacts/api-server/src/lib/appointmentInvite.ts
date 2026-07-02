import { sendMail } from "./mailer";
import { logger } from "./logger";

/**
 * Patient-facing appointment invite email. Fire-and-forget (never blocks the
 * proposing request). Reply-to is a real human mailbox, matching the consent
 * invite pattern. The confirm/decline link carries the one-time raw token.
 */

const REPLY_TO = "neimeyer@portlandinstitute.org";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAppointmentInvite(input: {
  to: string;
  firstName: string | null;
  providerName: string | null;
  title: string;
  startsAt: Date;
  location: string | null;
  origin: string;
  token: string;
}): Promise<void> {
  const greeting = input.firstName ? `Hello ${input.firstName},` : "Hello,";
  const who = input.providerName ? ` with ${input.providerName}` : "";
  const when = input.startsAt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const link = `${input.origin}/appointments/${input.token}`;
  const locationText = input.location ? `\nWhere: ${input.location}` : "";

  const text = [
    greeting,
    "",
    `A session${who} has been proposed for you: "${input.title}".`,
    `When: ${when}${locationText}`,
    "",
    "You can confirm or, if the time does not work, decline here:",
    link,
    "",
    "There is no pressure. Choose whatever feels right for you.",
    "",
    "With care,",
    "The MeaningBridge team",
  ].join("\n");

  const html = `<div style="font-family: Georgia, 'Times New Roman', serif; color: #22303f; line-height: 1.6; max-width: 520px;">
     <p>${greeting}</p>
     <p>A session${who ? escapeHtml(who) : ""} has been proposed for you: <em>${escapeHtml(input.title)}</em>.</p>
     <p><strong>When:</strong> ${escapeHtml(when)}${input.location ? `<br/><strong>Where:</strong> ${escapeHtml(input.location)}` : ""}</p>
     <p style="margin: 28px 0;"><a href="${link}" style="background:#2f8a86;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">Confirm or decline</a></p>
     <p style="color:#5b6b78;font-size:14px;">There is no pressure. Choose whatever feels right for you.</p>
     <p style="margin-top:28px;">With care,<br/>The MeaningBridge team</p>
   </div>`;

  const result = await sendMail({
    to: [input.to],
    subject: "A session has been proposed for you",
    text,
    html,
    replyTo: REPLY_TO,
  });
  if (!result.sent) {
    logger.warn({ err: result.error }, "appointment invite email not sent");
  }
}
