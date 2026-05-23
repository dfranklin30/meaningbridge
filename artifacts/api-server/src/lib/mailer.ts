import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env["GMAIL_USER"];
  const pass = process.env["GMAIL_APP_PASSWORD"];
  if (!user || !pass) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env["GMAIL_USER"] && process.env["GMAIL_APP_PASSWORD"]);
}

export interface SendMailInput {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendMail(input: SendMailInput): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn("sendMail skipped — GMAIL_USER / GMAIL_APP_PASSWORD not configured");
    return { sent: false, error: "mailer_not_configured" };
  }
  const from = process.env["GMAIL_USER"]!;
  try {
    const info = await transporter.sendMail({
      from: `"MeaningBridge" <${from}>`,
      to: input.to.join(", "),
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "sendMail failed");
    return { sent: false, error: message };
  }
}
