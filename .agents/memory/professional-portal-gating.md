---
name: Professional portal route gating (2FA / PHI)
description: How the clinician portal API layers auth gates, and the trap that catches OAuth-style browser-redirect callbacks.
---

# Professional portal route gating

In `artifacts/api-server/src/routes/professional.ts`, PHI routers are mounted with
`router.use(phiGate, subRouter)` where `phiGate = [requireAuth, requireProfessional, requireVerifiedProvider, requireTwoFactor]`.

**Trap:** `router.use(mw, subRouter)` (no path) applies `mw` to *every* unmatched path,
not just paths the subRouter handles. So a request to any path not matched by an
earlier router still runs the FIRST phiGate's `requireTwoFactor` and gets blocked.

**Why it matters:** SMART-on-FHIR OAuth callbacks are top-level browser redirects
from the EHR — they cannot satisfy an interactive 2FA modal. Such a callback route
must be mounted **before** any `router.use(phiGate, ...)` line, with its own lighter
gate (`requireAuth + requireProfessional + requireVerifiedProvider`, no 2FA), so it
matches and responds first. Order of `router.use` mounts is load-bearing here.

**How to apply:** Any new browser-redirect / non-XHR endpoint in the professional
router (OAuth callbacks, webhook returns) goes above the phiGate block. Verify with
`curl` that PHI routes still 403 without 2FA while the callback only requires auth.
