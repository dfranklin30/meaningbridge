import type { Request } from "express";

/**
 * Canonical public origin (scheme + host) used to build absolute, user-facing
 * links in outbound email — notably the patient consent invite.
 *
 * SECURITY: this must NOT trust request headers (Host / X-Forwarded-Host) as the
 * primary source. An authenticated provider could otherwise influence the host
 * baked into an emailed consent link, turning it into a phishing / token
 * exfiltration vector. We resolve from trusted configuration first:
 *   1. APP_ORIGIN — explicit override (e.g. a custom domain), if set.
 *   2. REPLIT_DOMAINS — the platform-assigned deployment domain(s); first wins.
 *   3. REPLIT_DEV_DOMAIN — the dev preview domain.
 *   4. request headers — last-resort local fallback only.
 */
export function appOrigin(req: Request): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const deployed = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (deployed) return `https://${deployed}`;

  const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (dev) return `https://${dev}`;

  const proto =
    (typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0]!.trim()
      : undefined) ?? req.protocol;
  const host =
    (typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"].split(",")[0]!.trim()
      : undefined) ?? req.headers.host;
  return `${proto}://${host}`;
}
