import type { Request, Response, NextFunction } from "express";

/**
 * Platform-admin gate for the oversight surfaces (provider verification, audit
 * review, PHI oversight). Admin is a boolean on the user row, orthogonal to the
 * seeker/professional role, and is never self-service.
 *
 * MUST run AFTER requireAuth, which attaches `req.appUser`.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.appUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.appUser.isAdmin) {
    res.status(403).json({ error: "Administrators only" });
    return;
  }
  next();
}
