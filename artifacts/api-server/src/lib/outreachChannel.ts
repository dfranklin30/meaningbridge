import { sendMail } from "./mailer";
import { logger } from "./logger";

/**
 * Delivery seam for all proactive outreach. Email is the only implementation
 * today; `channel` is the clean seam for future SMS (Twilio). We never silently
 * pretend to deliver on an unimplemented channel — an unsupported channel
 * returns delivered:false with a clear reason so the scheduler logs a "skipped".
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

  // SMS (Twilio) and other channels are reserved for later — a clean seam, not a
  // silent fallback.
  logger.warn({ channel: input.channel }, "outreach channel not implemented; skipping");
  return { delivered: false, error: `channel_not_implemented:${input.channel}` };
}
