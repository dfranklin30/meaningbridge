import { createHash, randomBytes } from "node:crypto";

/**
 * Appointment confirm/decline tokens are bearer credentials: whoever holds one
 * can confirm or decline a proposed session. We therefore treat them like the
 * consent tokens — only a SHA-256 hash is ever persisted
 * (`appointments.confirmTokenHash`); the raw token is emailed to the patient
 * once and never stored. Lookups hash the presented token and compare.
 */

/** Mint a new appointment token. Returns the raw token (email this) and its hash (store this). */
export function generateAppointmentToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAppointmentToken(token) };
}

/** Hash a presented token for constant-shape comparison against the stored hash. */
export function hashAppointmentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
