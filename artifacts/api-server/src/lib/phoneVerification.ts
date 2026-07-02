import { createHash, randomInt } from "node:crypto";

/**
 * Small, self-contained helpers for verifying a person's mobile number before we
 * ever text them. The one-time code is compared by hash (never stored or logged
 * in the clear), is short-lived, and attempts are throttled by the caller.
 */

export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS = 5;

/**
 * Normalize a user-typed number to E.164 (a leading "+" and digits only).
 * Returns null when the input cannot be a valid mobile number. A number typed
 * without a country code but with 10 digits is assumed to be North American
 * (+1), which matches this product's audience; anything already starting with
 * "+" is kept as-is after stripping separators.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** A user-friendly masked form for display, e.g. "+1 ••• ••• 4567". */
export function maskPhone(phone: string): string {
  const last4 = phone.slice(-4);
  return `••• ••• ${last4}`;
}

/** Generate a 6-digit numeric code as a zero-padded string. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function codeMatches(code: string, hash: string | null): boolean {
  if (!hash) return false;
  return hashCode(code.trim()) === hash;
}
