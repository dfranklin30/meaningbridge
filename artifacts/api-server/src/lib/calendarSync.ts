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
    throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
  }
  const event = (await res.json()) as { id?: string };
  return { eventId: event.id ?? null };
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
