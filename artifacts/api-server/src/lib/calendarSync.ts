/**
 * Calendar-sync seam, backed by the Replit-managed Google Calendar connector.
 *
 * Integration: Google Calendar connector via `@replit/connectors-sdk`. The rest
 * of the app calls ONLY these functions, so the appointment flow does not change
 * whether or not a calendar is connected. When no Google Calendar account is
 * connected, `isCalendarConnected()` returns false and callers fall back to
 * email-only scheduling. Once the connector is authorized, the same code creates
 * and deletes real events on the connected account — no other changes.
 *
 * The SDK's `proxy()` injects a fresh OAuth token on every call (identity is
 * resolved and tokens refreshed per request), so nothing here is cached — the
 * `ReplitConnectors` instance holds no credentials of its own.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";

import { logger } from "./logger";

const CONNECTOR_NAME = "google-calendar";
// The connector proxy forwards to the googleapis host root, so Calendar API
// paths must carry the full `/calendar/v3` prefix.
const CALENDAR_API = "/calendar/v3";

// Cheap to construct and holds no cached credentials (tokens are fetched fresh
// on every proxy call), so a single module-level instance is safe.
const connectors = new ReplitConnectors();

export interface CalendarEventInput {
  calendarId: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  attendeeEmail?: string | null;
}

export interface CalendarChoice {
  id: string;
  summary: string;
  primary: boolean;
}

/**
 * Raised when Google refuses a calendar write. Carries the HTTP status so
 * callers can tell "access lost / calendar deleted" (403/404) apart from a
 * transient failure and surface a calm, specific message to the provider.
 */
export class CalendarSyncError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CalendarSyncError";
  }
}

/**
 * Turn a caught calendar error into a calm, provider-facing sentence. Never
 * leaks raw Google payloads; distinguishes lost access / deleted calendar from
 * a generic hiccup.
 */
export function describeCalendarSyncError(err: unknown): string {
  const status = err instanceof CalendarSyncError ? err.status : 0;
  if (status === 403) {
    return "MeaningBridge no longer has permission to add events to this calendar, so this session was not added. Reconnect the calendar or choose another to resume syncing.";
  }
  if (status === 404 || status === 410) {
    return "The calendar chosen for sync could not be found — it may have been deleted or unshared — so this session was not added. Choose another calendar to resume syncing.";
  }
  return "This session could not be added to your Google Calendar just now. The invitation was still emailed to your patient.";
}

/**
 * Whether a Google Calendar account is connected. False until the integration
 * is authorized (or when the connector proxy is unreachable); callers fall back
 * to email-only scheduling.
 */
export async function isCalendarConnected(): Promise<boolean> {
  try {
    const connections = await connectors.listConnections({
      connector_names: CONNECTOR_NAME,
    });
    return connections.length > 0;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "calendar connection check failed",
    );
    return false;
  }
}

/**
 * List the calendars the connected Google account can write to, so a provider
 * can route MeaningBridge sessions to a work calendar instead of "primary".
 * Only calendars with owner/writer access are returned (you can't create events
 * on a read-only calendar). Returns an empty array when nothing is connected.
 */
export async function listCalendars(): Promise<CalendarChoice[]> {
  const res = await connectors.proxy(
    CONNECTOR_NAME,
    `${CALENDAR_API}/users/me/calendarList?minAccessRole=writer`,
    { method: "GET" },
  );
  if (!res.ok) {
    throw new Error(`Google Calendar list failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items?: Array<{ id?: string; summary?: string; summaryOverride?: string; primary?: boolean }>;
  };
  return (data.items ?? [])
    .filter((c): c is { id: string; summary?: string; summaryOverride?: string; primary?: boolean } =>
      typeof c.id === "string" && c.id.length > 0,
    )
    .map((c) => ({
      id: c.id,
      summary: c.summaryOverride || c.summary || c.id,
      primary: c.primary === true,
    }));
}

/**
 * Mirror a proposed/confirmed appointment onto the provider's calendar. Returns
 * the created event id, or null when calendar is not connected (email-only).
 */
export async function syncAppointmentToCalendar(
  input: CalendarEventInput,
): Promise<{ eventId: string | null }> {
  const body: Record<string, unknown> = {
    summary: input.title,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
  };
  if (input.description) body.description = input.description;
  if (input.location) body.location = input.location;
  if (input.attendeeEmail) body.attendees = [{ email: input.attendeeEmail }];

  const res = await connectors.proxy(
    CONNECTOR_NAME,
    `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events`,
    { method: "POST", body },
  );
  if (!res.ok) {
    throw new CalendarSyncError(
      `Google Calendar create failed: ${res.status} ${await res.text()}`,
      res.status,
    );
  }
  const event = (await res.json()) as { id?: string };
  return { eventId: event.id ?? null };
}

/**
 * Update an already-mirrored event in place with PATCH, so an edited time,
 * title, or location is reflected without deleting and recreating (which would
 * drop the event's history and re-fire notifications). Only the mutable fields
 * are sent; attendees are intentionally left untouched so an edit never
 * re-invites the patient. A 404/410 means the event is gone on the provider's
 * side; we surface that so the caller can fall back to creating a fresh one.
 */
export interface CalendarEventUpdateInput {
  calendarId: string;
  eventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  description?: string;
}

export async function updateAppointmentInCalendar(
  input: CalendarEventUpdateInput,
): Promise<{ ok: boolean; missing: boolean }> {
  const body: Record<string, unknown> = {
    summary: input.title,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
    // Send null to clear a removed location; PATCH otherwise leaves it as-is.
    location: input.location ?? null,
  };
  if (input.description) body.description = input.description;

  const res = await connectors.proxy(
    CONNECTOR_NAME,
    `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    { method: "PATCH", body },
  );
  if (res.status === 404 || res.status === 410) {
    return { ok: false, missing: true };
  }
  if (!res.ok) {
    throw new Error(`Google Calendar update failed: ${res.status} ${await res.text()}`);
  }
  return { ok: true, missing: false };
}

export interface ResolvedCalendar {
  /** The calendar id the event should actually be written to. */
  calendarId: string;
  /** True when the provider's chosen calendar was unavailable and we fell back. */
  fellBack: boolean;
}

/**
 * Validate a provider's saved calendar choice against the calendars the
 * connected account can currently write to. If the choice is gone (deleted,
 * unshared, or access revoked), fall back to the account's primary calendar so
 * the session still lands somewhere the provider can see — and report that a
 * fallback happened so the caller can note it. When the writable list cannot be
 * fetched, we do not block: return the original choice and let the event write
 * surface any real error.
 */
export async function resolveWritableCalendarId(preferredId: string): Promise<ResolvedCalendar> {
  let choices: CalendarChoice[];
  try {
    choices = await listCalendars();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "could not list calendars to validate choice; using saved choice as-is",
    );
    return { calendarId: preferredId, fellBack: false };
  }
  if (choices.length === 0) {
    // Nothing came back at all — don't second-guess; let the write attempt speak.
    return { calendarId: preferredId, fellBack: false };
  }
  if (choices.some((c) => c.id === preferredId)) {
    return { calendarId: preferredId, fellBack: false };
  }
  const primary = choices.find((c) => c.primary)?.id ?? "primary";
  return { calendarId: primary, fellBack: true };
}

/** Remove a previously mirrored event. */
export async function removeAppointmentFromCalendar(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await connectors.proxy(
    CONNECTOR_NAME,
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  // 404/410 mean it was already deleted — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}
