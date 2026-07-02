import { eq } from "drizzle-orm";
import { db, intakesTable } from "@workspace/db";

/**
 * Consent withdrawal purges the patient row's encrypted identity fields, but the
 * intake payload (`intakes.dataEnc`) holds a DUPLICATE copy of that PHI. Nulling
 * the patient row alone would leave the intake blob readable by the owning
 * provider, so withdrawal must purge the intake copy too. Returns the number of
 * intake rows cleared. The non-PHI shell (id, status, riskFlag) is retained so
 * the record of "an intake existed" survives for the audit trail.
 */
export async function purgeIntakePhiForPatient(patientId: number): Promise<number> {
  const rows = await db
    .update(intakesTable)
    .set({ dataEnc: null })
    .where(eq(intakesTable.patientId, patientId))
    .returning({ id: intakesTable.id });
  return rows.length;
}
