/**
 * Calendar-sync seam.
 *
 * Today this is a deliberate no-op stub: appointments work fully over email
 * regardless of whether a calendar is connected. When the Google Calendar
 * integration is wired at the platform level, replace the bodies below to
 * create / delete events on the connected account. The rest of the app calls
 * ONLY these functions, so no other code changes when calendar goes live.
 */

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
 * Whether a Google Calendar account is connected at the platform level. False
 * until the integration is set up; callers fall back to email-only scheduling.
 */
export async function isCalendarConnected(): Promise<boolean> {
  return false;
}

/**
 * Mirror a proposed/confirmed appointment onto the provider's calendar. Returns
 * the created event id, or null when calendar is not connected (email-only).
 */
export async function syncAppointmentToCalendar(
  _input: CalendarEventInput,
): Promise<{ eventId: string | null }> {
  return { eventId: null };
}

/** Remove a previously mirrored event. No-op until Google Calendar is connected. */
export async function removeAppointmentFromCalendar(
  _calendarId: string,
  _eventId: string,
): Promise<void> {
  // Seam: live delete lands with the Google Calendar integration.
}
