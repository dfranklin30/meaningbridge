import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * One-time, idempotent backfill so accounts created before additive
 * capabilities existed keep working unchanged.
 *
 * Older rows only carried the legacy `role` column ("seeker" | "professional").
 * The app now gates access on `is_seeker` / `is_professional` and tracks the
 * open portal in `active_space`. This derives those from `role` for any row that
 * has not been migrated yet. It is safe to run on every startup: each statement
 * only touches rows whose target columns are still stale, so a second run is a
 * no-op.
 */
export async function backfillCapabilities(): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE users
      SET is_seeker = true
      WHERE role = 'seeker' AND is_seeker = false
    `);
    await db.execute(sql`
      UPDATE users
      SET is_professional = true
      WHERE role = 'professional' AND is_professional = false
    `);
    await db.execute(sql`
      UPDATE users
      SET active_space = role
      WHERE role IN ('seeker', 'professional') AND active_space IS NULL
    `);
    logger.info("Capability backfill complete (legacy role -> is_seeker/is_professional/active_space)");
  } catch (err) {
    // Never block startup on a backfill failure; the JIT path in requireAuth
    // and /me still resolve capabilities per-account on next access.
    logger.error({ err }, "Capability backfill failed");
  }
}
