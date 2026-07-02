import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, providerSecurityTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireProfessional } from "../middlewares/requireProfessional";
import { logAudit as audit } from "../lib/audit";
import { encryptPhi, decryptPhi } from "../lib/phi";
import {
  generateTotpSecret,
  totpAuthUri,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  issueTwoFactorCookie,
  twoFactorCookieOptions,
  twoFactorCookieValid,
  TWO_FACTOR_COOKIE,
  IDLE_TIMEOUT_MINUTES,
} from "../lib/twoFactor";

const router: IRouter = Router();

/**
 * Provider two-factor (authenticator-app TOTP) enrollment and challenge.
 *
 * Clerk owns identity/password/email verification; this route adds the second
 * factor the managed Clerk tenant cannot provide. Verified second-factor state
 * lives in a signed idle-timeout cookie (see lib/twoFactor).
 */

const codeInput = z.object({ code: z.string().min(1) });
const challengeInput = z.object({
  code: z.string().optional(),
  recoveryCode: z.string().optional(),
});

async function loadSecurity(userId: number) {
  const [row] = await db
    .select()
    .from(providerSecurityTable)
    .where(eq(providerSecurityTable.userId, userId))
    .limit(1);
  return row ?? null;
}

router.get("/security", requireAuth, requireProfessional, async (req, res) => {
  const sec = await loadSecurity(req.userId!);
  const enabled = Boolean(sec?.totpEnabledAt);
  const active =
    enabled && twoFactorCookieValid(req.cookies?.[TWO_FACTOR_COOKIE] as string | undefined, req.userId!);
  res.json({
    totpEnabled: enabled,
    twoFactorActive: active,
    recoveryCodesRemaining: sec?.recoveryCodes.length ?? 0,
    idleTimeoutMinutes: IDLE_TIMEOUT_MINUTES,
  });
});

router.post("/security/totp/setup", requireAuth, requireProfessional, async (req, res) => {
  const sec = await loadSecurity(req.userId!);
  if (sec?.totpEnabledAt) {
    res.status(409).json({ error: "Two-factor is already enabled", code: "already_enabled" });
    return;
  }

  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  const secret = generateTotpSecret();
  const secretEnc = encryptPhi(secret);
  if (sec) {
    await db
      .update(providerSecurityTable)
      .set({ totpSecretEnc: secretEnc, totpEnabledAt: null, recoveryCodes: [] })
      .where(eq(providerSecurityTable.userId, req.userId!));
  } else {
    await db
      .insert(providerSecurityTable)
      .values({ userId: req.userId!, totpSecretEnc: secretEnc });
  }

  const account = user?.email || `provider-${req.userId}`;
  res.json({ secret, otpauthUri: totpAuthUri(secret, account) });
});

router.post("/security/totp/enable", requireAuth, requireProfessional, async (req, res) => {
  const parsed = codeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid code", details: parsed.error.issues });
    return;
  }
  const sec = await loadSecurity(req.userId!);
  if (!sec?.totpSecretEnc) {
    res.status(400).json({ error: "Start setup first", code: "no_pending_setup" });
    return;
  }
  if (sec.totpEnabledAt) {
    res.status(409).json({ error: "Two-factor is already enabled", code: "already_enabled" });
    return;
  }
  const secret = decryptPhi(sec.totpSecretEnc);
  if (!secret || !verifyTotp(secret, parsed.data.code)) {
    res.status(400).json({ error: "That code did not match", code: "invalid_code" });
    return;
  }

  const { plain, hashes } = generateRecoveryCodes();
  await db
    .update(providerSecurityTable)
    .set({ totpEnabledAt: new Date(), recoveryCodes: hashes })
    .where(eq(providerSecurityTable.userId, req.userId!));

  res.cookie(TWO_FACTOR_COOKIE, issueTwoFactorCookie(req.userId!), twoFactorCookieOptions());
  await audit(req, "provider.2fa.enable");
  res.json({ recoveryCodes: plain });
});

router.post("/security/totp/challenge", requireAuth, requireProfessional, async (req, res) => {
  const parsed = challengeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const sec = await loadSecurity(req.userId!);
  if (!sec?.totpEnabledAt || !sec.totpSecretEnc) {
    res.status(400).json({ error: "Two-factor is not enabled", code: "not_enabled" });
    return;
  }

  const { code, recoveryCode } = parsed.data;
  let ok = false;

  if (code) {
    const secret = decryptPhi(sec.totpSecretEnc);
    ok = Boolean(secret && verifyTotp(secret, code));
  } else if (recoveryCode) {
    const hash = hashRecoveryCode(recoveryCode);
    if (sec.recoveryCodes.includes(hash)) {
      ok = true;
      await db
        .update(providerSecurityTable)
        .set({ recoveryCodes: sec.recoveryCodes.filter((h) => h !== hash) })
        .where(eq(providerSecurityTable.userId, req.userId!));
      await audit(req, "provider.2fa.recovery_used");
    }
  }

  if (!ok) {
    res.status(400).json({ error: "That code did not match", code: "invalid_code" });
    return;
  }

  res.cookie(TWO_FACTOR_COOKIE, issueTwoFactorCookie(req.userId!), twoFactorCookieOptions());
  await audit(req, "provider.2fa.challenge");
  res.json({ ok: true });
});

router.post("/security/totp/disable", requireAuth, requireProfessional, async (req, res) => {
  const parsed = codeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid code", details: parsed.error.issues });
    return;
  }
  const sec = await loadSecurity(req.userId!);
  if (!sec?.totpEnabledAt || !sec.totpSecretEnc) {
    res.status(400).json({ error: "Two-factor is not enabled", code: "not_enabled" });
    return;
  }
  const secret = decryptPhi(sec.totpSecretEnc);
  if (!secret || !verifyTotp(secret, parsed.data.code)) {
    res.status(400).json({ error: "That code did not match", code: "invalid_code" });
    return;
  }
  await db
    .update(providerSecurityTable)
    .set({ totpSecretEnc: null, totpEnabledAt: null, recoveryCodes: [] })
    .where(eq(providerSecurityTable.userId, req.userId!));
  res.clearCookie(TWO_FACTOR_COOKIE, twoFactorCookieOptions());
  await audit(req, "provider.2fa.disable");
  res.json({ ok: true });
});

export default router;
