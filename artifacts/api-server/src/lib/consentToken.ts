import { createHash, randomBytes } from "node:crypto";

/**
 * Consent-link tokens are bearer credentials: whoever holds one can sign a
 * patient's consent. We therefore treat them like passwords — only a SHA-256
 * hash is ever persisted (`patients.consentTokenHash`); the raw token is emailed
 * to the patient once and never stored. Lookups hash the presented token and
 * compare against the stored hash.
 */

/** Mint a new consent token. Returns the raw token (email this) and its hash (store this). */
export function generateConsentToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashConsentToken(token) };
}

/** Hash a presented token for constant-shape comparison against the stored hash. */
export function hashConsentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
