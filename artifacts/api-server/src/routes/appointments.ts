import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appointmentsTable, providersTable, type Appointment } from "@workspace/db";
import { RespondToAppointmentBody } from "@workspace/api-zod";
import { hashAppointmentToken } from "../lib/appointmentToken";
import { removeAppointmentFromCalendar, syncAppointmentToCalendar, isCalendarConnected } from "../lib/calendarSync";

/**
 * Public, token-gated appointment confirmation. The patient receives a raw
 * confirm/decline token by email; only its SHA-256 hash is stored. There is no
 * login here — the bearer token is the credential — so responses expose only the
 * minimum view (title/time/provider name), never patient PHI or provider PII
 * beyond a display name.
 */

const router: IRouter = Router();

async function providerName(providerUserId: number): Promise<string | null> {
  const [row] = await db
    .select({ fullName: providersTable.fullName })
    .from(providersTable)
    .where(eq(providersTable.userId, providerUserId))
    .limit(1);
  return row?.fullName ?? null;
}

async function publicView(appt: Appointment) {
  return {
    title: appt.title,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    status: appt.status,
    providerName: await providerName(appt.providerUserId),
    location: appt.location,
  };
}

async function findByToken(token: string): Promise<Appointment | null> {
  const hash = hashAppointmentToken(token);
  const [row] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.confirmTokenHash, hash))
    .limit(1);
  return row ?? null;
}

router.get("/:token", async (req, res) => {
  const appt = await findByToken(req.params.token);
  if (!appt) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await publicView(appt));
});

router.post("/:token", async (req, res) => {
  const parsed = RespondToAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decision", details: parsed.error.issues });
    return;
  }
  const appt = await findByToken(req.params.token);
  if (!appt) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Only a still-proposed appointment can be acted on; confirming/declining is
  // idempotent-safe (a repeat POST on a resolved appointment just echoes state).
  if (appt.status !== "proposed") {
    res.json(await publicView(appt));
    return;
  }

  const nextStatus = parsed.data.decision === "confirm" ? "confirmed" : "declined";
  let googleEventId = appt.googleEventId;

  if (nextStatus === "confirmed" && (await isCalendarConnected())) {
    try {
      const { eventId } = await syncAppointmentToCalendar({
        calendarId: appt.googleCalendarId ?? "primary",
        title: appt.title,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        location: appt.location,
      });
      googleEventId = eventId;
    } catch (err) {
      req.log.warn({ err }, "calendar sync on confirm failed (email flow unaffected)");
    }
  }
  if (nextStatus === "declined" && appt.googleEventId && appt.googleCalendarId) {
    try {
      await removeAppointmentFromCalendar(appt.googleCalendarId, appt.googleEventId);
      googleEventId = null;
    } catch (err) {
      req.log.warn({ err }, "calendar removal on decline failed");
    }
  }

  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: nextStatus, googleEventId, updatedAt: new Date() })
    .where(eq(appointmentsTable.id, appt.id))
    .returning();
  res.json(await publicView(updated!));
});

export default router;
