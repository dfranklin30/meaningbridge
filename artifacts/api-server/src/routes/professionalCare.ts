import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  appointmentsTable,
  providerCalendarTable,
  type Appointment,
  type ProviderCalendar,
} from "@workspace/db";
import {
  AskProviderAssistantBody,
  EditAppointmentBody,
  ProposeAppointmentBody,
  UpdateProviderCalendarBody,
} from "@workspace/api-zod";
import { getPatientForProvider } from "../lib/patientAccess";
import { isOutreachAllowedStatus } from "../lib/outreachConsent";
import { parseId } from "../lib/professionalViews";
import { logAudit as audit } from "../lib/audit";
import { decryptPhi } from "../lib/phi";
import { appOrigin } from "../lib/appUrl";
import { buildPatientEngagement, answerProviderQuestion } from "../lib/providerAssistant";
import { generateAppointmentToken } from "../lib/appointmentToken";
import { sendAppointmentInvite } from "../lib/appointmentInvite";
import {
  describeCalendarSyncError,
  isCalendarConnected,
  listCalendars,
  removeAppointmentFromCalendar,
  resolveWritableCalendarId,
  syncAppointmentToCalendar,
  updateAppointmentInCalendar,
} from "../lib/calendarSync";

/**
 * Provider-facing care surface — mounted behind the PHI gate (verified provider
 * + active second factor) in routes/professional.ts. Two capabilities:
 *   1. The provider assistant: answers a clinician's questions about a patient
 *      from ENGAGEMENT METADATA ONLY (counts/timestamps/tier), never any
 *      companion or journal content.
 *   2. Appointments: propose a session (emails the patient a confirm/decline
 *      link, mirrors to the calendar when connected) and cancel one.
 * Plus the provider's own calendar-sync setting.
 *
 * Every patient-scoped handler authorizes via getPatientForProvider so a
 * provider can only ever touch patients they are linked to.
 */

const router: IRouter = Router();

function toAppointment(a: Appointment) {
  return {
    id: a.id,
    patientId: a.patientId,
    providerUserId: a.providerUserId,
    title: a.title,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    status: a.status,
    location: a.location,
    notes: a.notes,
    googleEventId: a.googleEventId,
    calendarSyncStatus: a.calendarSyncStatus,
    calendarSyncMessage: a.calendarSyncMessage,
    createdAt: a.createdAt,
  };
}

function toCalendarView(cal: ProviderCalendar, connected: boolean) {
  return {
    provider: cal.provider,
    calendarId: cal.calendarId,
    syncEnabled: cal.syncEnabled,
    connected,
  };
}

async function getOrCreateCalendar(providerUserId: number): Promise<ProviderCalendar> {
  const [existing] = await db
    .select()
    .from(providerCalendarTable)
    .where(eq(providerCalendarTable.providerUserId, providerUserId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(providerCalendarTable)
    .values({ providerUserId })
    .onConflictDoNothing({ target: providerCalendarTable.providerUserId })
    .returning();
  if (created) return created;
  const [row] = await db
    .select()
    .from(providerCalendarTable)
    .where(eq(providerCalendarTable.providerUserId, providerUserId))
    .limit(1);
  return row!;
}

// --- engagement (metadata only) --------------------------------------------

router.get("/patients/:id/engagement", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const engagement = await buildPatientEngagement(patient);
  await audit(req, "patient.engagement.view", { detail: `patient ${id}` });
  res.json(engagement);
});

// --- provider assistant (metadata only) ------------------------------------

router.post("/patients/:id/assistant", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AskProviderAssistantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid question", details: parsed.error.issues });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const engagement = await buildPatientEngagement(patient);
  const answer = await answerProviderQuestion({
    engagement,
    patientLabel: `Patient #${patient.id}`,
    question: parsed.data.question,
  });
  await audit(req, "patient.assistant.ask", { detail: `patient ${id}` });
  res.json({ answer });
});

// --- appointments ----------------------------------------------------------

router.get("/patients/:id/appointments", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.patientId, id))
    .orderBy(desc(appointmentsTable.startsAt));
  res.json(rows.map(toAppointment));
});

router.post("/patients/:id/appointments", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = ProposeAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid appointment", details: parsed.error.issues });
    return;
  }
  const patient = await getPatientForProvider(req.userId!, id);
  if (!patient) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Consent floor: a session may only be proposed to a consented/active patient.
  if (!isOutreachAllowedStatus(patient.status)) {
    res.status(409).json({
      error: "This patient has not completed consent yet, so a session cannot be scheduled.",
    });
    return;
  }
  if (parsed.data.endsAt <= parsed.data.startsAt) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const { token, hash } = generateAppointmentToken();
  const calendar = await getOrCreateCalendar(req.userId!);

  let googleEventId: string | null = null;
  let googleCalendarId: string | null = null;
  let calendarSyncStatus: string | null = null;
  let calendarSyncMessage: string | null = null;
  if (calendar.syncEnabled && (await isCalendarConnected())) {
    // Validate the saved choice first: a deleted/unshared calendar falls back to
    // primary (with a note) instead of the write failing silently.
    const resolved = await resolveWritableCalendarId(calendar.calendarId);
    try {
      const { eventId } = await syncAppointmentToCalendar({
        calendarId: resolved.calendarId,
        title: parsed.data.title ?? "MeaningBridge session",
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        location: parsed.data.location ?? null,
        attendeeEmail: decryptPhi(patient.emailEnc),
      });
      googleEventId = eventId;
      googleCalendarId = resolved.calendarId;
      if (resolved.fellBack) {
        calendarSyncStatus = "fallback";
        calendarSyncMessage =
          "Your selected calendar was no longer available, so this session was added to your primary Google Calendar instead. Pick a calendar again to change where sessions sync.";
      } else {
        calendarSyncStatus = "synced";
      }
    } catch (err) {
      calendarSyncStatus = "failed";
      calendarSyncMessage = describeCalendarSyncError(err);
      req.log.warn({ err }, "calendar sync on propose failed (email flow unaffected)");
    }
  }

  const [row] = await db
    .insert(appointmentsTable)
    .values({
      providerUserId: req.userId!,
      patientId: id,
      title: parsed.data.title ?? "MeaningBridge session",
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      status: "proposed",
      confirmTokenHash: hash,
      googleEventId,
      googleCalendarId,
      calendarSyncStatus,
      calendarSyncMessage,
    })
    .returning();

  const email = decryptPhi(patient.emailEnc);
  if (email) {
    void sendAppointmentInvite({
      to: email,
      firstName: decryptPhi(patient.firstNameEnc),
      providerName: null,
      title: row!.title,
      startsAt: row!.startsAt,
      location: row!.location,
      origin: appOrigin(req),
      token,
    });
  }

  await audit(req, "appointment.propose", { detail: `patient ${id} appointment ${row!.id}` });
  res.status(201).json(toAppointment(row!));
});

router.patch("/appointments/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = EditAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid appointment", details: parsed.error.issues });
    return;
  }
  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, id), eq(appointmentsTable.providerUserId, req.userId!)))
    .limit(1);
  if (!appt) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Only a still-live session can be edited; a declined/cancelled one has no
  // calendar event to keep in sync and should not silently reanimate.
  if (appt.status !== "proposed" && appt.status !== "confirmed") {
    res.status(409).json({ error: "This appointment can no longer be edited." });
    return;
  }

  // Merge: only provided fields change. location/notes are nullable, so an
  // explicit null clears them while an absent key leaves them as-is.
  const title = parsed.data.title?.trim() || appt.title;
  const startsAt = parsed.data.startsAt ?? appt.startsAt;
  const endsAt = parsed.data.endsAt ?? appt.endsAt;
  const location =
    parsed.data.location !== undefined ? (parsed.data.location?.trim() || null) : appt.location;
  const notes =
    parsed.data.notes !== undefined ? (parsed.data.notes?.trim() || null) : appt.notes;
  if (endsAt <= startsAt) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  // Keep the mirrored event in step with the edit. Update the existing event
  // when one is mirrored; if it has drifted away (deleted on the provider's
  // side) or was never created, fall back to creating one — but only while the
  // provider has sync enabled and a calendar is connected. Failures never break
  // the appointment write, matching the create/delete seams.
  let googleEventId = appt.googleEventId;
  let googleCalendarId = appt.googleCalendarId;
  try {
    const connected = await isCalendarConnected();
    if (connected && googleEventId && googleCalendarId) {
      const { missing } = await updateAppointmentInCalendar({
        calendarId: googleCalendarId,
        eventId: googleEventId,
        title,
        startsAt,
        endsAt,
        location,
      });
      if (missing) {
        googleEventId = null;
        googleCalendarId = null;
      }
    }
    if (connected && !googleEventId) {
      const calendar = await getOrCreateCalendar(req.userId!);
      if (calendar.syncEnabled) {
        const patient = await getPatientForProvider(req.userId!, appt.patientId);
        const { eventId } = await syncAppointmentToCalendar({
          calendarId: calendar.calendarId,
          title,
          startsAt,
          endsAt,
          location,
          attendeeEmail: patient ? decryptPhi(patient.emailEnc) : null,
        });
        googleEventId = eventId;
        googleCalendarId = calendar.calendarId;
      }
    }
  } catch (err) {
    req.log.warn({ err }, "calendar sync on edit failed (appointment saved regardless)");
  }

  const [row] = await db
    .update(appointmentsTable)
    .set({ title, startsAt, endsAt, location, notes, googleEventId, googleCalendarId, updatedAt: new Date() })
    .where(eq(appointmentsTable.id, id))
    .returning();
  await audit(req, "appointment.edit", { detail: `appointment ${id}` });
  res.json(toAppointment(row!));
});

router.post("/appointments/:id/cancel", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [appt] = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.id, id), eq(appointmentsTable.providerUserId, req.userId!)))
    .limit(1);
  if (!appt) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (appt.googleEventId && appt.googleCalendarId) {
    try {
      await removeAppointmentFromCalendar(appt.googleCalendarId, appt.googleEventId);
    } catch (err) {
      req.log.warn({ err }, "calendar removal on cancel failed");
    }
  }
  const [row] = await db
    .update(appointmentsTable)
    .set({
      status: "cancelled",
      googleEventId: null,
      calendarSyncStatus: null,
      calendarSyncMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, id))
    .returning();
  await audit(req, "appointment.cancel", { detail: `appointment ${id}` });
  res.json(toAppointment(row!));
});

// --- calendar-sync setting -------------------------------------------------

router.get("/calendar", async (req, res) => {
  const calendar = await getOrCreateCalendar(req.userId!);
  res.json(toCalendarView(calendar, await isCalendarConnected()));
});

router.get("/calendar/list", async (req, res) => {
  if (!(await isCalendarConnected())) {
    res.json([]);
    return;
  }
  try {
    res.json(await listCalendars());
  } catch (err) {
    req.log.warn({ err }, "listing google calendars failed");
    res.json([]);
  }
});

router.put("/calendar", async (req, res) => {
  const parsed = UpdateProviderCalendarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid calendar settings", details: parsed.error.issues });
    return;
  }
  await getOrCreateCalendar(req.userId!);
  const [row] = await db
    .update(providerCalendarTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(providerCalendarTable.providerUserId, req.userId!))
    .returning();
  await audit(req, "calendar.update", {});
  res.json(toCalendarView(row!, await isCalendarConnected()));
});

export default router;
