import type { Request, Response, NextFunction } from "express";

/**
 * Role gate for clinician-only endpoints.
 *
 * MUST run AFTER requireAuth, which resolves and attaches `req.appUser`.
 * Gates on the additive `isProfessional` capability, so an account that is
 * both a seeker and a professional keeps clinician access regardless of which
 * space it is currently viewing.
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
  if (!req.appUser.isProfessional) {
    res.status(403).json({ error: "Professionals only" });
    return;
  }
  next();
}
