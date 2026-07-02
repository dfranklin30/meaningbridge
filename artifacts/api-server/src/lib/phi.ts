import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

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
 * The 32-byte AES key comes from the `PHI_ENCRYPTION_KEY` env var. If that value
 * already decodes to exactly 32 bytes (base64 or hex — e.g. `openssl rand -base64
 * 32`), it is used directly. Otherwise it is treated as a passphrase and a
 * 32-byte key is derived from it with scrypt, so a human-supplied secret of any
 * length still yields a valid, deterministic key. It is read lazily and cached on
 * first use so the process can boot in environments that never touch PHI, but any
 * attempt to encrypt or decrypt without a key set fails loudly — never silently
 * stores plain text.
 *
 * Note: with the derived-passphrase path, key strength tracks the entropy of the
 * supplied secret, so a long, random passphrase is strongly preferred. The
 * derivation salt is a fixed application constant (deterministic across restarts);
 * changing `PHI_ENCRYPTION_KEY` after PHI has been written makes existing
 * ciphertext unreadable, so treat the value as permanent for a given dataset.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Fixed, non-secret salt for passphrase derivation. The secret is the passphrase,
// not the salt; a constant salt keeps the derived key stable across restarts.
const KDF_SALT = "meaningbridge:phi:v1";

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

  // Fast path: a value that already decodes to exactly 32 bytes is used directly
  // as the AES-256 key (base64 or hex, e.g. `openssl rand -base64 32`).
  for (const encoding of ["base64", "hex"] as const) {
    try {
      const buf = Buffer.from(value, encoding);
      if (buf.length === 32) {
        cachedKey = buf;
        return cachedKey;
      }
    } catch {
      // try the next encoding
    }
  }

  // Otherwise treat the value as a passphrase and derive a 32-byte key.
  cachedKey = scryptSync(value, KDF_SALT, 32);
  return cachedKey;
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
