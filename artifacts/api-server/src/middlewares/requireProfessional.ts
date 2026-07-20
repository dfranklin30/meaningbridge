import type { Request, Response, NextFunction } from "express";

/**
 * Role gate for clinician endpoints — RELAXED during development/testing.
 *
 * MUST run AFTER requireAuth, which resolves and attaches `req.appUser`.
 * Previously required the `isProfessional` capability; per Dr. Neimeyer's
 * direction, any signed-in account may enter the professional portal while we
 * develop and test (no role registration, licensure, or verification needed).
 */
export function requireProfessional(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.appUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
