---
name: Calendar-sync failure surfacing
description: Provider calendar-sync outcomes are persisted per-appointment and validated against the writable list, never failing silently.
---

# Calendar-sync failure surfacing

When mirroring a session to a provider's Google Calendar, the outcome is
**persisted on the appointment row** (a status + a calm human-readable message),
not just returned transiently. The status is one of `synced` / `fallback` /
`failed` (null when sync was off/not connected). The provider patient-detail
page renders a per-session notice for `fallback`/`failed`; `synced`/null show
nothing (silence = reassurance).

Before writing, the saved calendar choice is validated against the account's
current writable list. A deleted/unshared/access-revoked calendar falls back to
the primary calendar (status `fallback`) instead of erroring; a genuine write
refusal (403 = access lost, 404/410 = calendar gone) is caught and mapped to a
specific sentence, never a raw Google payload.

**Why:** Task #38 let clinicians choose which calendar syncs. If they later lose
access, event creation used to fail with only a `req.log.warn`, so the clinician
kept believing sessions were on their calendar. Persisting the outcome is what
makes the warning survive a page reload and stay tied to the specific session.

**How to apply:** Any new calendar write path (e.g. rescheduling, reminders)
should reuse `resolveWritableCalendarId` + `describeCalendarSyncError` from
`lib/calendarSync.ts` and record the outcome the same way rather than swallowing
the error in a log line. `CalendarSyncError` carries the HTTP status for
classification.
