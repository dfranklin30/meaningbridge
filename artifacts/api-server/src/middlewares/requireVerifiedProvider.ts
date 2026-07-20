import type { Request, Response, NextFunction } from "express";

/**
 * Provider verification gate — DISABLED during development/testing.
 *
 * Admin verification previously blocked access here until a manual credential
 * check. Per Dr. Neimeyer's direction, all professionals (licensed or not,
 * including hospice workers, death doulas, clergy, educators, and colleagues
 * abroad) go straight to the portal while we develop and test. Reintroduce a
 * verification step only when recruiting a paid professional referral network.
 */
export async function requireVerifiedProvider(
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
