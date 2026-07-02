---
name: Provider portal data-access pattern
description: Clinician-facing pages use a manual api()+2FA-guard helper, not the generated react-query hooks the seeker app uses.
---

# Provider portal data-access pattern

Two distinct data-access styles coexist in the web app:

- **Seeker (patient) pages** use the generated react-query hooks from
  `@workspace/api-client-react` (e.g. `useListCompanionMemory`, `useGetOutreachPreferences`).
- **Provider/clinician pages** (under the care portal) use a manual `api(path, init)`
  helper plus `useTwoFactorGate().guard()` and the shared `PhiNotice` / `ErrorBanner`
  / `Spinner` from the provider shell. They do NOT use the generated hooks.

**Why:** Provider requests must pass through the 2FA idle-timeout gate before any
PHI-adjacent call; the gate must queue every blocked request (a single-slot gate
deadlocks parallel guarded fetches). The manual helper is where that gating lives.

**How to apply:** New clinician-facing pages follow the manual `api()`+`guard()`
pattern (copy an existing care page); new patient-facing pages use the generated
hooks. Keep provider pages metadata-only — never render patient content.
