import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * App-level authenticator-app (TOTP, RFC 6238) second factor for provider
 * accounts. Clerk owns identity/password/email verification; this adds a second
 * factor on top of the existing session for accounts that touch real PHI.
 *
 * The verified-second-factor state lives in a signed, HMAC'd cookie carrying the
 * verification time, which also implements the idle-timeout re-auth: the cookie
 * is only accepted within IDLE_TIMEOUT_MINUTES of the last verification and is
 * slid forward on each authorized PHI request.
 */

const ISSUER = "MeaningBridge";
const DIGITS = 6;
const PERIOD = 30;
const WINDOW = 1; // accept +/- one 30s step for clock skew

export const TWO_FACTOR_COOKIE = "mb_2fa";
export const IDLE_TIMEOUT_MINUTES = 15;
const IDLE_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;

// ---- base32 (RFC 4648, no padding) ----------------------------------------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---- TOTP ------------------------------------------------------------------
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAuthUri(secret: string, account: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function verifyTotp(secret: string, token: string): boolean {
  const t = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    if (safeEqual(hotp(secret, counter + w), t)) return true;
  }
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---- recovery codes --------------------------------------------------------
export function generateRecoveryCodes(n = 10): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = base32Encode(randomBytes(5)).slice(0, 8).toLowerCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plain.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { plain, hashes };
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(code.trim().toLowerCase().replace(/\s/g, ""))
    .digest("hex");
}

// ---- signed idle-timeout cookie -------------------------------------------
function sessionSecret(): string {
  return process.env["SESSION_SECRET"] ?? "";
}

export function issueTwoFactorCookie(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, verifiedAt: Date.now() }),
  ).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function twoFactorCookieValid(value: string | undefined, userId: number): boolean {
  if (!value || !sessionSecret()) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId?: number;
      verifiedAt?: number;
    };
    if (data.userId !== userId || typeof data.verifiedAt !== "number") return false;
    return Date.now() - data.verifiedAt <= IDLE_MS;
  } catch {
    return false;
  }
}

export function twoFactorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/api",
    maxAge: IDLE_MS,
  };
}
