import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, providerSecurityTable } from "@workspace/db";
import {
  TWO_FACTOR_COOKIE,
  issueTwoFactorCookie,
  twoFactorCookieOptions,
  twoFactorCookieValid,
} from "../lib/twoFactor";

/**
 * Requires a valid authenticator-app second factor for PHI access.
 *
 * MUST run after requireAuth. Emits machine-readable codes so the UI can decide
 * whether to prompt enrollment (`two_factor_setup_required`) or a fresh code
 * (`two_factor_challenge_required`, also raised when the idle window lapses).
 * On success the idle-timeout cookie is slid forward.
 */
export async function requireTwoFactor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [sec] = await db
    .select({ enabledAt: providerSecurityTable.totpEnabledAt })
    .from(providerSecurityTable)
    .where(eq(providerSecurityTable.userId, req.userId))
    .limit(1);

  if (!sec || !sec.enabledAt) {
    res.status(403).json({
      error: "Set up two-factor authentication before accessing patient data",
      code: "two_factor_setup_required",
    });
    return;
  }

  const cookie = req.cookies?.[TWO_FACTOR_COOKIE] as string | undefined;
  if (!twoFactorCookieValid(cookie, req.userId)) {
    res.status(403).json({
      error: "Confirm your identity to continue",
      code: "two_factor_challenge_required",
    });
    return;
  }

  // Sliding idle timeout: extend the window on each authorized request.
  res.cookie(TWO_FACTOR_COOKIE, issueTwoFactorCookie(req.userId), twoFactorCookieOptions());
  next();
}
