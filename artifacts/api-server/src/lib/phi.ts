import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-layer encryption for patient PHI (name, DOB, contact info,
 * clinical intake blobs, referral summaries, OAuth tokens). Every value stored
 * in a column suffixed `Enc` passes through here.
 *
 * Scheme: AES-256-GCM. Ciphertext is serialized as
 *   `v1:` + base64( iv(12) || authTag(16) || ciphertext )
 * so the version is self-describing and a single string round-trips through a
 * plain text column.
 *
 * The 32-byte key comes from the `PHI_ENCRYPTION_KEY` env var (base64, hex, or
 * raw utf-8). It is read lazily and validated on first use so the process can
 * boot in environments that never touch PHI, but any attempt to encrypt or
 * decrypt without a valid key fails loudly — never silently stores plain text.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PHI_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "PHI_ENCRYPTION_KEY is not set. Patient PHI cannot be encrypted or decrypted without it.",
    );
  }
  const value = raw.trim();
  let key: Buffer | null = null;

  // Prefer base64, then hex, then raw utf-8 — accept whichever yields 32 bytes.
  const candidates: Array<() => Buffer> = [
    () => Buffer.from(value, "base64"),
    () => Buffer.from(value, "hex"),
    () => Buffer.from(value, "utf-8"),
  ];
  for (const make of candidates) {
    try {
      const buf = make();
      if (buf.length === 32) {
        key = buf;
        break;
      }
    } catch {
      // try the next encoding
    }
  }

  if (!key) {
    throw new Error(
      "PHI_ENCRYPTION_KEY must decode to exactly 32 bytes (accepts base64, hex, or raw utf-8).",
    );
  }
  cachedKey = key;
  return key;
}

/** True when a usable key is configured (for startup diagnostics). */
export function isPhiKeyConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a plaintext string. `null`/`undefined` pass through unchanged so
 * optional PHI columns can stay null. Throws if no key is configured.
 */
export function encryptPhi(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

/**
 * Decrypt a value produced by {@link encryptPhi}. `null`/`undefined` pass
 * through. Throws on a malformed payload or a failed auth-tag check (tamper /
 * wrong key) rather than returning corrupt data.
 */
export function decryptPhi(payload: string | null | undefined): string | null {
  if (payload === null || payload === undefined) return null;
  const [version, body] = payload.split(":", 2);
  if (version !== VERSION || !body) {
    throw new Error("Unrecognized PHI ciphertext format.");
  }
  const key = loadKey();
  const raw = Buffer.from(body, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new Error("PHI ciphertext is too short to be valid.");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

/** Encrypt a JSON-serializable value as one PHI blob. */
export function encryptPhiJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return encryptPhi(JSON.stringify(value));
}

/** Decrypt a blob written by {@link encryptPhiJson}. Returns null if absent. */
export function decryptPhiJson<T = unknown>(payload: string | null | undefined): T | null {
  const text = decryptPhi(payload);
  if (text === null) return null;
  return JSON.parse(text) as T;
}
