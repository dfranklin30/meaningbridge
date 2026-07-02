---
name: Provider 2FA gate concurrency
description: useTwoFactorGate must queue ALL blocked requests, not one, or parallel loads deadlock
---

# Provider portal `useTwoFactorGate` must queue every blocked request

The clinician portal wraps PHI fetches in `guard(() => api(...))` from
`artifacts/meaningbridge/src/pages/care/provider-shell.tsx`. When a request hits
the PHI gate it can return `403` with code `two_factor_challenge_required`; the
gate then shows one `TwoFactorChallenge` modal and retries the original request
on success.

**Rule:** the gate must hold a *list* of pending waiters (retry + cancel per
blocked request), not a single slot. On challenge success retry them all; on
cancel reject them all with the original `ApiError`.

**Why:** pages routinely fire several guarded requests in parallel (e.g. a
`Promise.all` of `/batch-imports/fields` + `/batch-imports` on the bulk-import
page load). If two get `403` at once and the gate stores only the last
`{retry, cancel}` slot, the earlier promise's resolver is overwritten and never
settles — `Promise.all` hangs and the page is stuck loading forever.

**How to apply:** any new provider page that guards multiple concurrent fetches
is safe as long as the shared gate keeps the waiter queue. Do not "simplify" the
gate back to a single pending-state object.
