import { sendMail } from "./mailer";
import { sendSms } from "./smsSender";
import { logger } from "./logger";

/**
 * Delivery seam for all proactive outreach. Email and SMS are both live; the
 * `channel` field selects the transport. We never silently pretend to deliver on
 * an unimplemented channel — an unsupported channel (or one whose credentials
 * are absent) returns delivered:false with a clear reason so the scheduler logs
 * a "failed"/"skipped" and never double-sends.
 */

const REPLY_TO = "neimeyer@portlandinstitute.org";

export interface OutreachMessage {
  channel: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function deliverOutreach(
  input: OutreachMessage,
): Promise<{ delivered: boolean; error?: string }> {
  if (input.channel === "email") {
    const result = await sendMail({
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: REPLY_TO,
    });
    return { delivered: result.sent, error: result.error };
  }

  if (input.channel === "sms") {
    // SMS ignores subject/html — the plain text is the message.
    const result = await sendSms({ to: input.to, body: input.text });
    return { delivered: result.sent, error: result.error };
  }

  // Any other channel has no implementation — a clean seam, not a silent fallback.
  logger.warn({ channel: input.channel }, "outreach channel not implemented; skipping");
  return { delivered: false, error: `channel_not_implemented:${input.channel}` };
}
