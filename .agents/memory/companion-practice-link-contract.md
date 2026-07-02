---
name: Companion task → practice deep-link contract
description: Companion tasks store a practice slug, but the practice player route is keyed by numeric id — resolve before linking.
---

# Companion task → practice deep-link contract

Companion tasks carry an optional `practiceSlug` (string). The practices player
route is `/practices/:id` and parses `:id` as a **number** (`useGetPractice(parseInt(id))`).
There is no slug-based practice GET endpoint.

**Rule:** Never link a companion task straight to `/practices/${practiceSlug}`.
Resolve the slug to a numeric id first (e.g. load the practices list and match on
`slug`), and hide the deep-link when no practice matches the slug.

**Why:** A slug in the numeric route silently resolves to an invalid practice id
and the player fails to open — breaking the "practice recommendations link into
the app" flow with no error.

**How to apply:** Any UI that turns a companion task into a practice link (task
panels, dashboards, emails) must map slug→id, or a slug-based practice endpoint
must be added and the route/player updated in lockstep.
