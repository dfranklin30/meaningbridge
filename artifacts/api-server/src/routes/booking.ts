import { Router, type IRouter, type Response } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  healthieGraphQL,
  HealthieNotConfiguredError,
  HealthieError,
} from "../lib/healthie";
import { checkBookingEligibility } from "../lib/bookingGate";

/**
 * Appointment booking, ported from Healthie's official sample booking widget
 * (github.com/healthie/healthie_sample_booking_widget, MIT) but with the GraphQL
 * moved server-side: the browser calls these endpoints, and we own each fixed
 * Healthie query so the API key never leaves the server. Errors are returned as
 * inline JSON (the sample used browser alerts).
 *
 * Flow mirrors the sample: appointment type -> available slot -> contact info ->
 * book. Booking is additionally gated on signed intake + consent forms (Phase B).
 */

const router: IRouter = Router();
router.use(requireAuth);

// --- Ported GraphQL operations (from the sample widget) ---------------------

const APPOINTMENT_TYPES = `
  query appointmentTypes($provider_id: String, $clients_can_book: Boolean) {
    appointmentTypes(provider_id: $provider_id, clients_can_book: $clients_can_book) {
      id
      name
      length
      available_contact_types
      is_group
    }
  }
`;

const AVAILABLE_SLOTS = `
  query availableSlotsForRange(
    $provider_id: String
    $start_date: String
    $end_date: String
    $contact_type: String
    $timezone: String
    $appt_type_id: String
    $org_level: Boolean
  ) {
    availableSlotsForRange(
      provider_id: $provider_id
      start_date: $start_date
      end_date: $end_date
      contact_type: $contact_type
      timezone: $timezone
      appt_type_id: $appt_type_id
      org_level: $org_level
    ) {
      user_id
      date
      appointment_id
      is_fully_booked
    }
  }
`;

const COMPLETE_BOOKING = `
  mutation completeCheckout(
    $appointment_type_id: String
    $contact_type: String
    $date: String
    $first_name: String
    $last_name: String
    $email: String
    $phone_number: String
    $provider_id: String
    $timezone: String
  ) {
    completeCheckout(
      input: {
        appointment_type_id: $appointment_type_id
        contact_type: $contact_type
        date: $date
        timezone: $timezone
        first_name: $first_name
        last_name: $last_name
        email: $email
        phone_number: $phone_number
        provider_id: $provider_id
      }
    ) {
      appointment {
        id
        date
        start
        end
        location
        contact_type
        add_to_gcal_link
        provider {
          id
          full_name
        }
        appointment_type {
          id
          name
          length
        }
      }
      messages {
        field
        message
      }
    }
  }
`;

// --- Helpers ----------------------------------------------------------------

async function healthieIdFor(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ hid: usersTable.healthieUserId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return row?.hid ?? null;
}

/**
 * Map a thrown Healthie error to a calm inline JSON response. Returns true when
 * it handled the error (response sent); false when the caller should rethrow.
 */
function sendHealthieError(res: Response, err: unknown): boolean {
  if (err instanceof HealthieNotConfiguredError) {
    res.status(503).json({ error: "Scheduling is not available yet." });
    return true;
  }
  if (err instanceof HealthieError) {
    res.status(502).json({ error: err.message });
    return true;
  }
  return false;
}

// --- Routes -----------------------------------------------------------------

const ApptTypesQuery = z.object({ providerId: z.string().min(1) });

router.get("/appointment-types", async (req, res) => {
  const parsed = ApptTypesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "providerId is required" });
    return;
  }
  try {
    const data = await healthieGraphQL<{
      appointmentTypes: Array<{
        id: string;
        name: string;
        length: number | null;
        available_contact_types: string[] | null;
        is_group: boolean | null;
      }> | null;
    }>(APPOINTMENT_TYPES, {
      provider_id: parsed.data.providerId,
      clients_can_book: true,
    });
    res.json(
      (data.appointmentTypes ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        length: t.length ?? null,
        contactTypes: t.available_contact_types ?? [],
        isGroup: !!t.is_group,
      })),
    );
  } catch (err) {
    if (sendHealthieError(res, err)) return;
    throw err;
  }
});

const SlotsQuery = z.object({
  providerId: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  contactType: z.string().min(1),
  date: z.string().min(1),
  timezone: z.string().optional(),
});

router.get("/available-slots", async (req, res) => {
  const parsed = SlotsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid slot query", details: parsed.error.issues });
    return;
  }
  const q = parsed.data;
  try {
    const data = await healthieGraphQL<{
      availableSlotsForRange: Array<{
        user_id: string;
        date: string;
        appointment_id: string | null;
        is_fully_booked: boolean | null;
      }> | null;
    }>(AVAILABLE_SLOTS, {
      provider_id: q.providerId,
      appt_type_id: q.appointmentTypeId,
      contact_type: q.contactType,
      start_date: q.date,
      end_date: q.date,
      timezone: q.timezone || "America/New_York",
      org_level: false,
    });
    res.json(
      (data.availableSlotsForRange ?? []).map((s) => ({
        providerId: s.user_id,
        date: s.date,
        appointmentId: s.appointment_id ?? null,
        isFullyBooked: !!s.is_fully_booked,
      })),
    );
  } catch (err) {
    if (sendHealthieError(res, err)) return;
    throw err;
  }
});

router.get("/eligibility", async (req, res) => {
  const hid = await healthieIdFor(req.userId!);
  if (!hid) {
    res.json({ allowed: false, reason: "not_linked", missingFormIds: [] });
    return;
  }
  try {
    const e = await checkBookingEligibility(hid);
    res.json({
      allowed: e.allowed,
      reason: e.allowed ? null : "forms_incomplete",
      missingFormIds: e.missingFormIds,
    });
  } catch (err) {
    if (err instanceof HealthieNotConfiguredError) {
      res.json({ allowed: false, reason: "not_configured", missingFormIds: [] });
      return;
    }
    if (err instanceof HealthieError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

interface BookedApptRaw {
  id: string;
  date: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  contact_type: string | null;
  add_to_gcal_link: string | null;
  provider: { id: string; full_name: string | null } | null;
  appointment_type: { id: string; name: string | null; length: number | null } | null;
}

const BookingBody = z.object({
  providerId: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  contactType: z.string().min(1),
  date: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().min(1),
  phoneNumber: z.string().min(1),
  timezone: z.string().optional(),
});

router.post("/appointments", async (req, res) => {
  const parsed = BookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid booking", details: parsed.error.issues });
    return;
  }

  const hid = await healthieIdFor(req.userId!);
  if (!hid) {
    res.status(409).json({
      error: "Your account is not connected to the scheduling service yet.",
      reason: "not_linked",
    });
    return;
  }

  try {
    // Gate: intake + consent must be signed before a first booking.
    const eligibility = await checkBookingEligibility(hid);
    if (!eligibility.allowed) {
      res.status(403).json({
        error:
          "Please complete your intake and consent forms before booking your first session.",
        reason: "forms_incomplete",
        missingFormIds: eligibility.missingFormIds,
      });
      return;
    }

    const b = parsed.data;
    const data = await healthieGraphQL<{
      completeCheckout: {
        appointment: BookedApptRaw | null;
        messages: Array<{ field: string | null; message: string }> | null;
      } | null;
    }>(COMPLETE_BOOKING, {
      appointment_type_id: b.appointmentTypeId,
      contact_type: b.contactType,
      date: b.date,
      provider_id: b.providerId,
      first_name: b.firstName,
      last_name: b.lastName,
      email: b.email,
      phone_number: b.phoneNumber,
      timezone: b.timezone || "America/New_York",
    });

    const payload = data.completeCheckout;
    if (payload?.messages && payload.messages.length > 0) {
      // Healthie business-validation messages (e.g. slot taken) — safe to show.
      res.status(422).json({ error: payload.messages[0]!.message, messages: payload.messages });
      return;
    }
    const appt = payload?.appointment;
    if (!appt) {
      res.status(502).json({ error: "Booking did not complete. Please try again." });
      return;
    }
    res.json({
      id: appt.id,
      date: appt.date ?? null,
      start: appt.start ?? null,
      end: appt.end ?? null,
      contactType: appt.contact_type ?? null,
      location: appt.location ?? null,
      providerName: appt.provider?.full_name ?? null,
      appointmentTypeName: appt.appointment_type?.name ?? null,
      addToGcalLink: appt.add_to_gcal_link ?? null,
    });
  } catch (err) {
    if (sendHealthieError(res, err)) return;
    throw err;
  }
});

export default router;
