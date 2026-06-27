import type { Request, Response, NextFunction } from "express";

/**
 * Role gate for clinician-only endpoints.
 *
 * MUST run AFTER requireAuth, which resolves and attaches `req.appUser`.
 * Rejects anyone who is not a professional so that no clinician-scoped data
 * is ever served to a seeker account.
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
  if (req.appUser.role !== "professional") {
    res.status(403).json({ error: "Professionals only" });
    return;
  }
  next();
}
