import { logger } from "./logger";

/**
 * SMS delivery via the Twilio REST API. Mirrors the mailer's philosophy: it is
 * configured through environment secrets (not a cached SDK client) and degrades
 * gracefully — when the credentials are absent it returns
 * `{ sent: false, error: "sms_not_configured" }` rather than throwing, so the
 * outreach scheduler logs a "failed"/"skipped" and never crashes.
 *
 * Required secrets:
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_FROM_NUMBER  (an SMS-capable number in E.164, e.g. +15551234567,
 *                          or a Messaging Service SID beginning with "MG")
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

function getConfig(): TwilioConfig | null {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM_NUMBER"];
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

export function isSmsConfigured(): boolean {
  return getConfig() !== null;
}

export async function sendSms(input: {
  to: string;
  body: string;
}): Promise<{ sent: boolean; sid?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    logger.warn("sendSms skipped — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not configured");
    return { sent: false, error: "sms_not_configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", input.to);
  // A Messaging Service SID (MG...) uses MessagingServiceSid; a plain number uses From.
  if (config.from.startsWith("MG")) {
    form.set("MessagingServiceSid", config.from);
  } else {
    form.set("From", config.from);
  }
  form.set("Body", input.body);

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Twilio returns a JSON body with a `message` field on error; surface it
      // compactly for the outreach log without leaking the whole payload.
      let message = `twilio_http_${res.status}`;
      try {
        const parsed = JSON.parse(detail) as { message?: string; code?: number };
        if (parsed.message) message = `${message}:${parsed.message}`;
      } catch {
        // non-JSON error body — keep the status-only message
      }
      logger.error({ status: res.status }, "sendSms failed");
      return { sent: false, error: message };
    }
    const data = (await res.json()) as { sid?: string };
    return { sent: true, sid: data.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "sendSms failed");
    return { sent: false, error: message };
  }
}
