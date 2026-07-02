/**
 * Calendar-sync seam, backed by the Replit-managed Google Calendar connector.
 *
 * The rest of the app calls ONLY these functions, so the appointment flow does
 * not change whether or not a calendar is connected. When no Google Calendar
 * account is connected, `isCalendarConnected()` returns false and callers fall
 * back to email-only scheduling. Once the connector is authorized, the same code
 * creates and deletes real events on the connected account — no other changes.
 *
 * The connector access token is fetched fresh on every call (tokens expire and
 * must never be cached), using the Replit connector proxy.
 */

import { logger } from "./logger";

const CONNECTOR_NAME = "google-calendar";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CalendarEventInput {
  calendarId: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  attendeeEmail?: string | null;
}

/**
 * Fetch a live Google Calendar access token from the Replit connector proxy.
 * Returns null when the connector is not configured/authorized in this
 * environment, so callers can degrade to email-only scheduling.
 */
async function getAccessToken(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return null;
  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!xReplitToken) return null;

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${CONNECTOR_NAME}`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{
        settings?: {
          access_token?: string;
          oauth?: { credentials?: { access_token?: string } };
        };
      }>;
    };
    const settings = data.items?.[0]?.settings;
    return settings?.access_token ?? settings?.oauth?.credentials?.access_token ?? null;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "calendar token fetch failed");
    return null;
  }
}

/**
 * Whether a Google Calendar account is connected. False until the integration
 * is authorized; callers fall back to email-only scheduling.
 */
export async function isCalendarConnected(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

/**
 * Mirror a proposed/confirmed appointment onto the provider's calendar. Returns
 * the created event id, or null when calendar is not connected (email-only).
 */
export async function syncAppointmentToCalendar(
  input: CalendarEventInput,
): Promise<{ eventId: string | null }> {
  const token = await getAccessToken();
  if (!token) return { eventId: null };

  const body: Record<string, unknown> = {
    summary: input.title,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
  };
  if (input.description) body.description = input.description;
  if (input.location) body.location = input.location;
  if (input.attendeeEmail) body.attendees = [{ email: input.attendeeEmail }];

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
  }
  const event = (await res.json()) as { id?: string };
  return { eventId: event.id ?? null };
}

/** Remove a previously mirrored event. No-op when calendar is not connected. */
export async function removeAppointmentFromCalendar(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  // 410 Gone means it was already deleted — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}
