import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, patientsTable, providerPatientLinksTable, intakesTable } from "@workspace/db";
import {
  accessiblePatientIds,
  getPatientForProvider,
  linkProviderToPatient,
  listPatientsForProvider,
  providerCanAccessPatient,
} from "../src/lib/patientAccess";
import { purgeIntakePhiForPatient } from "../src/lib/phiPurge";

/**
 * Provider-isolation ("minimum necessary") integration test. Runs against the
 * real dev database and proves the single choke point in patientAccess.ts denies
 * a provider any patient they are not explicitly linked to. Fixtures are torn
 * down in afterAll so repeated runs stay clean.
 */
describe("patientAccess provider isolation", () => {
  let providerA = 0;
  let providerB = 0;
  let patientId = 0;

  beforeAll(async () => {
    const [a] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "professional" })
      .returning();
    const [b] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "professional" })
      .returning();
    providerA = a!.id;
    providerB = b!.id;

    const [p] = await db
      .insert(patientsTable)
      .values({ ownerProviderUserId: providerA, status: "active" })
      .returning();
    patientId = p!.id;

    await linkProviderToPatient(providerA, patientId, "owner");
  });

  afterAll(async () => {
    await db.delete(intakesTable).where(eq(intakesTable.patientId, patientId));
    await db.delete(providerPatientLinksTable).where(eq(providerPatientLinksTable.patientId, patientId));
    await db.delete(patientsTable).where(eq(patientsTable.id, patientId));
    await db.delete(usersTable).where(eq(usersTable.id, providerA));
    await db.delete(usersTable).where(eq(usersTable.id, providerB));
    await pool.end();
  });

  it("grants the owning provider access", async () => {
    expect(await providerCanAccessPatient(providerA, patientId)).toBe(true);
    expect(await getPatientForProvider(providerA, patientId)).not.toBeNull();
    expect(await accessiblePatientIds(providerA)).toContain(patientId);
    expect((await listPatientsForProvider(providerA)).map((p) => p.id)).toContain(patientId);
  });

  it("denies an unlinked provider", async () => {
    expect(await providerCanAccessPatient(providerB, patientId)).toBe(false);
    // null (not a 403) so forbidden is indistinguishable from missing.
    expect(await getPatientForProvider(providerB, patientId)).toBeNull();
    expect(await accessiblePatientIds(providerB)).not.toContain(patientId);
    expect((await listPatientsForProvider(providerB)).map((p) => p.id)).not.toContain(patientId);
  });

  it("hides a revoked patient even from the owning provider", async () => {
    // Simulate consent withdrawal: status -> revoked (PHI purge happens in the
    // route). The link row is retained, but visibility must stop immediately.
    await db.update(patientsTable).set({ status: "revoked" }).where(eq(patientsTable.id, patientId));

    expect(await providerCanAccessPatient(providerA, patientId)).toBe(false);
    expect(await getPatientForProvider(providerA, patientId)).toBeNull();
    expect(await accessiblePatientIds(providerA)).not.toContain(patientId);
    expect((await listPatientsForProvider(providerA)).map((p) => p.id)).not.toContain(patientId);
  });

  it("purges the duplicated PHI held in the patient's intake blob on withdrawal", async () => {
    const [intake] = await db
      .insert(intakesTable)
      .values({
        providerUserId: providerA,
        patientId,
        status: "submitted",
        dataEnc: "ciphertext-placeholder",
      })
      .returning();

    const cleared = await purgeIntakePhiForPatient(patientId);
    expect(cleared).toBeGreaterThanOrEqual(1);

    const [after] = await db
      .select({ dataEnc: intakesTable.dataEnc, status: intakesTable.status })
      .from(intakesTable)
      .where(eq(intakesTable.id, intake!.id))
      .limit(1);
    expect(after?.dataEnc).toBeNull();
    // Non-PHI shell is retained for the audit record.
    expect(after?.status).toBe("submitted");
  });
});
