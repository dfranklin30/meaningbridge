import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import {
  db,
  pool,
  usersTable,
  patientsTable,
  providersTable,
  appointmentsTable,
} from "@workspace/db";
import appointmentsRouter from "../src/routes/appointments";
import { generateAppointmentToken } from "../src/lib/appointmentToken";
import { buildPatientEngagement } from "../src/lib/providerAssistant";

/**
 * End-to-end guard for the public, token-gated appointment flow and the
 * metadata-only provider view. Runs against the real dev database. The public
 * appointment router is mounted with NO auth middleware — exactly as it is in
 * the app — so these tests also prove confirm/decline requires no login and the
 * response never leaks patient content.
 */

// Provider-authored PHI-free logistics only; a no-op logger keeps req.log.warn
// callable on the (unreached here) calendar-sync error paths.
function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = {
      info() {},
      warn() {},
      error() {},
      debug() {},
    };
    next();
  });
  app.use(express.json());
  app.use("/appointments", appointmentsRouter);
  return app;
}

describe("public appointment confirm flow (no login)", () => {
  const app = makeApp();
  let providerUserId = 0;
  let patientId = 0;

  beforeAll(async () => {
    const [provider] = await db
      .insert(usersTable)
      .values({ clerkUserId: `test_${randomUUID()}`, role: "professional" })
      .returning();
    providerUserId = provider!.id;
    await db.insert(providersTable).values({ userId: providerUserId, fullName: "Dr. Test" });
    const [patient] = await db
      .insert(patientsTable)
      .values({ ownerProviderUserId: providerUserId, status: "active" })
      .returning();
    patientId = patient!.id;
  });

  afterAll(async () => {
    await db.delete(appointmentsTable).where(eq(appointmentsTable.patientId, patientId));
    await db.delete(patientsTable).where(eq(patientsTable.id, patientId));
    await db.delete(providersTable).where(eq(providersTable.userId, providerUserId));
    await db.delete(usersTable).where(eq(usersTable.id, providerUserId));
    await pool.end();
  });

  async function insertProposed(overrides: Partial<typeof appointmentsTable.$inferInsert> = {}) {
    const { token, hash } = generateAppointmentToken();
    const [row] = await db
      .insert(appointmentsTable)
      .values({
        providerUserId,
        patientId,
        title: "MeaningBridge session",
        startsAt: new Date("2026-07-10T15:00:00.000Z"),
        endsAt: new Date("2026-07-10T15:30:00.000Z"),
        status: "proposed",
        location: "Video link",
        notes: "provider-only note",
        confirmTokenHash: hash,
        ...overrides,
      })
      .returning();
    return { token, id: row!.id };
  }

  it("serves the appointment by token with no auth and exposes no patient content", async () => {
    const { token } = await insertProposed();
    const res = await request(app).get(`/appointments/${token}`);
    expect(res.status).toBe(200);
    // Minimal public view only.
    expect(res.body).toMatchObject({
      title: "MeaningBridge session",
      status: "proposed",
      providerName: "Dr. Test",
      location: "Video link",
    });
    // Never leak identifiers, provider-only notes, or the token hash.
    expect(res.body).not.toHaveProperty("patientId");
    expect(res.body).not.toHaveProperty("providerUserId");
    expect(res.body).not.toHaveProperty("notes");
    expect(res.body).not.toHaveProperty("confirmTokenHash");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await request(app).get(`/appointments/${generateAppointmentToken().token}`);
    expect(res.status).toBe(404);
  });

  it("echoes the server's actual status when the appointment is already resolved", async () => {
    // Token still resolvable but the appointment was already declined elsewhere.
    // A confirm click must NOT flip it to confirmed — the server echoes truth.
    const { token } = await insertProposed({ status: "declined" });
    const res = await request(app).post(`/appointments/${token}`).send({ decision: "confirm" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("declined");
  });

  it("confirms a proposed appointment without login and invalidates the token (single-use)", async () => {
    const { token, id } = await insertProposed();
    const res = await request(app).post(`/appointments/${token}`).send({ decision: "confirm" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");

    // The bearer token is cleared in the same write, so the link is dead.
    const [row] = await db
      .select({ hash: appointmentsTable.confirmTokenHash })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .limit(1);
    expect(row?.hash).toBeNull();

    const replay = await request(app).get(`/appointments/${token}`);
    expect(replay.status).toBe(404);
  });

  it("rejects an invalid decision body", async () => {
    const { token } = await insertProposed();
    const res = await request(app).post(`/appointments/${token}`).send({ decision: "maybe" });
    expect(res.status).toBe(400);
  });

  it("builds a metadata-only engagement view carrying no patient content", async () => {
    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .limit(1);
    const engagement = await buildPatientEngagement(patient!);

    // The provider patient-detail surface is fed by this view. It is strictly
    // counts/timestamps/status/tier — never journal, chat, or companion content.
    const allowedKeys = new Set([
      "patientId",
      "status",
      "tier",
      "sessionCount",
      "lastActiveAt",
      "companionMessageCount",
      "journalEntryCount",
      "checkinCount",
      "lastCheckinAt",
      "safetyEventCount",
      "openSafetyEventCount",
      "lastSafetyEventAt",
    ]);
    for (const key of Object.keys(engagement)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});
