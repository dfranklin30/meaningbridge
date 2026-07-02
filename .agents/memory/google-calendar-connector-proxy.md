---
name: Google Calendar connector proxy path prefix
description: The @replit/connectors-sdk proxy forwards to the googleapis host root, so Calendar API paths must include /calendar/v3.
---

# Google Calendar connector proxy

`ReplitConnectors.proxy("google-calendar", path)` forwards to the Google API
**host root** (`https://www.googleapis.com`), NOT the Calendar API base. So the
path must carry the full `/calendar/v3` prefix, e.g.
`/calendar/v3/calendars/{id}/events`. A path like `/calendars/.../events` or
`/users/me/calendarList` returns Google's generic HTML **404** (not JSON) — easy
to mistake for "not connected."

**Why:** The connector proxy only strips the connector's host; it does not know
the per-service API version base path. The blueprint's example endpoints omit
the prefix and are misleading.

**How to apply:** When adding any Google Calendar call via the SDK proxy, prefix
with `/calendar/v3`. If a proxy call returns `text/html` with a 404, suspect a
missing version prefix before suspecting auth. `listConnections({connector_names:
"google-calendar"})` returning a connection with `status: "healthy"` confirms the
connection is authorized independent of any path issue.
