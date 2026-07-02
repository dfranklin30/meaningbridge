import type { Request } from "express";
import { db, auditLogTable } from "@workspace/db";

/**
 * Shared audit-log helper for every sensitive read/write across the app
 * (care relationships, professional portal, PHI access). Writes are
 * best-effort: an audit failure is logged but never breaks the request.
 *
 * Actions use a dotted namespace, e.g. `provider.create`, `patient.view`,
 * `intake.submit`, `referral.accept`, `phi.decrypt`.
 */

/** Best-effort client IP, honoring a single upstream proxy hop. */
export function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? null;
}

export interface AuditOptions {
  /** The user the action concerns (e.g. a linked seeker), if any. */
  subjectUserId?: number | null;
  /** A related care-relationship row, if the action is care-scoped. */
  relationshipId?: number | null;
  /** Free-form, non-PHI detail (counts, ids, status) for the trail. */
  detail?: string | null;
}

/**
 * Record an audited action for the current request's actor. Never throws.
 */
export async function logAudit(req: Request, action: string, opts: AuditOptions = {}): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorUserId: req.userId ?? null,
      action,
      subjectUserId: opts.subjectUserId ?? null,
      relationshipId: opts.relationshipId ?? null,
      detail: opts.detail ?? null,
      ip: clientIp(req),
    });
  } catch (err) {
    req.log.error({ err, action }, "audit log write failed");
  }
}
