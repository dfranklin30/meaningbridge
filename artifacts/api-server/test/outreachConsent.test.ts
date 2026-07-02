import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, patientsTable } from "@workspace/db";
import { isOutreachAllowedStatus, isUserOutreachAllowed } from "../src/lib/outreachConsent";

/**
 * Consent-floor test. Runs against the real dev database and proves that
 * proactive outreach stops the instant a linked patient's clinical consent
 * ends, while a self-serve seeker (no enrollment) is still governed by their own
 * preferences.
 */
describe("outreach consent floor", () => {
  let seekerId = 0;
  let enrolledUserId = 0;
  let providerId = 0;
  let patientId = 0;

  beforeAll(async () => {
    const [seeker] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "seeker" })
      .returning();
    const [enrolled] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "seeker" })
      .returning();
    const [provider] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "professional" })
      .returning();
    seekerId = seeker!.id;
    enrolledUserId = enrolled!.id;
    providerId = provider!.id;

    const [p] = await db
      .insert(patientsTable)
      .values({ ownerProviderUserId: providerId, linkedUserId: enrolledUserId, status: "active" })
      .returning();
    patientId = p!.id;
  });

  afterAll(async () => {
    await db.delete(patientsTable).where(eq(patientsTable.id, patientId));
    await db.delete(usersTable).where(eq(usersTable.id, seekerId));
    await db.delete(usersTable).where(eq(usersTable.id, enrolledUserId));
    await db.delete(usersTable).where(eq(usersTable.id, providerId));
    await pool.end();
  });

  it("classifies statuses correctly", () => {
    expect(isOutreachAllowedStatus("consented")).toBe(true);
    expect(isOutreachAllowedStatus("active")).toBe(true);
    expect(isOutreachAllowedStatus("revoked")).toBe(false);
    expect(isOutreachAllowedStatus("inactive")).toBe(false);
    expect(isOutreachAllowedStatus("invited")).toBe(false);
    expect(isOutreachAllowedStatus("draft")).toBe(false);
  });

  it("allows a self-serve seeker with no enrollment", async () => {
    expect(await isUserOutreachAllowed(seekerId)).toBe(true);
  });

  it("allows a consented/active enrolled user", async () => {
    expect(await isUserOutreachAllowed(enrolledUserId)).toBe(true);
  });

  it("suppresses outreach immediately once consent is withdrawn", async () => {
    await db.update(patientsTable).set({ status: "revoked" }).where(eq(patientsTable.id, patientId));
    expect(await isUserOutreachAllowed(enrolledUserId)).toBe(false);

    await db.update(patientsTable).set({ status: "inactive" }).where(eq(patientsTable.id, patientId));
    expect(await isUserOutreachAllowed(enrolledUserId)).toBe(false);
  });
});
