import { and, eq, inArray } from "drizzle-orm";
import { db, providerPatientLinksTable, patientsTable, type Patient } from "@workspace/db";

/**
 * Central authorization for patient PHI. Access is granted ONLY through a
 * `provider_patient_links` row — never inferred from the UI or from ownership
 * alone. The owning provider is linked at patient creation; accepted referrals
 * add links. Admins are handled separately (they use the audited oversight
 * surfaces, not these provider-scoped helpers).
 *
 * Every provider-facing patient query in later phases must route through here so
 * there is a single, testable choke point for the "minimum necessary" rule.
 */

/** All patient ids a provider is linked to (owned or referred). */
export async function accessiblePatientIds(providerUserId: number): Promise<number[]> {
  const rows = await db
    .select({ patientId: providerPatientLinksTable.patientId })
    .from(providerPatientLinksTable)
    .where(eq(providerPatientLinksTable.providerUserId, providerUserId));
  return rows.map((r) => r.patientId);
}

/** True if the provider currently has a link to the patient. */
export async function providerCanAccessPatient(
  providerUserId: number,
  patientId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: providerPatientLinksTable.id })
    .from(providerPatientLinksTable)
    .where(
      and(
        eq(providerPatientLinksTable.providerUserId, providerUserId),
        eq(providerPatientLinksTable.patientId, patientId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Load a patient row only if the provider is authorized to see it. Returns
 * `null` when the patient does not exist or the provider has no link, so
 * callers cannot distinguish "forbidden" from "missing" (no enumeration).
 */
export async function getPatientForProvider(
  providerUserId: number,
  patientId: number,
): Promise<Patient | null> {
  if (!(await providerCanAccessPatient(providerUserId, patientId))) return null;
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  return patient ?? null;
}

/** Load every patient a provider may access, in one query. */
export async function listPatientsForProvider(providerUserId: number): Promise<Patient[]> {
  const ids = await accessiblePatientIds(providerUserId);
  if (ids.length === 0) return [];
  return db.select().from(patientsTable).where(inArray(patientsTable.id, ids));
}

/**
 * Grant a provider access to a patient (idempotent). Used at patient creation
 * ("owner") and when a referral is accepted ("referred").
 */
export async function linkProviderToPatient(
  providerUserId: number,
  patientId: number,
  relationship: "owner" | "referred" = "owner",
): Promise<void> {
  await db
    .insert(providerPatientLinksTable)
    .values({ providerUserId, patientId, relationship })
    .onConflictDoNothing({
      target: [providerPatientLinksTable.patientId, providerPatientLinksTable.providerUserId],
    });
}
