import type { Request, Response, NextFunction } from "express";

/**
 * Two-factor PHI gate — DISABLED during development/testing.
 *
 * The authenticator-app requirement (and its idle-timeout re-challenge)
 * repeatedly locked testers out of the portal. Per Dr. Neimeyer's direction it
 * is suspended while we develop and test; the /care/security page still lets
 * anyone enrol voluntarily. Restore the full gate before real client PHI is
 * handled in production.
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
  next();
}
