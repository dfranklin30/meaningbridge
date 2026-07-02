import { eq } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";

/**
 * Consent floor for all proactive outreach and scheduling.
 *
 * Proactive messages (companion check-ins, task reminders, appointment
 * reminders) and provider-initiated scheduling may only reach people who are
 * currently consented/active. When a patient withdraws consent their status
 * becomes "revoked" (or "inactive"), and outreach must stop immediately — the
 * preference flags alone are NOT sufficient authority to keep messaging someone
 * whose clinical consent has ended.
 */

/** True only for statuses that permit proactive outreach / scheduling. */
export function isOutreachAllowedStatus(status: string): boolean {
  return status === "consented" || status === "active";
}

/**
 * Whether proactive, self-directed outreach (check-ins, task reminders) may be
 * sent to this app user.
 *
 * A self-serve seeker with no provider enrollment is governed solely by their
 * own outreach preferences (enabling check-ins is their own opt-in), so we allow
 * it. But once a user is linked to one or more provider-enrolled patient
 * records, their clinical consent state is the floor: if every linked enrollment
 * is revoked/inactive, all proactive outreach stops immediately regardless of
 * the preference flags.
 */
export async function isUserOutreachAllowed(userId: number): Promise<boolean> {
  const rows = await db
    .select({ status: patientsTable.status })
    .from(patientsTable)
    .where(eq(patientsTable.linkedUserId, userId));
  if (rows.length === 0) return true;
  return rows.some((r) => isOutreachAllowedStatus(r.status));
}
