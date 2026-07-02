import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, providersTable } from "@workspace/db";

/**
 * Gate that blocks patient/PHI access until a provider is admin-verified.
 *
 * MUST run after requireAuth + requireProfessional. Returns a machine-readable
 * `code` so the UI can route the provider to the onboarding or pending state
 * instead of showing a generic error.
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
  const [row] = await db
    .select({ status: providersTable.verificationStatus })
    .from(providersTable)
    .where(eq(providersTable.userId, req.userId))
    .limit(1);

  if (!row) {
    res
      .status(403)
      .json({ error: "Complete your provider profile first", code: "no_provider_profile" });
    return;
  }
  if (row.status !== "verified") {
    res.status(403).json({
      error: "Your provider account is pending verification",
      code: "provider_unverified",
      status: row.status,
    });
    return;
  }
  next();
}
