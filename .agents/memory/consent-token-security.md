---
name: Public consent-token security
description: Rules for the patient e-sign bearer-token flow (public /api/consent/:token) so tokens can't leak or be replayed.
---

# Public consent-token flow (patient e-sign)

The patient consent link is authed by a bearer token in the **URL path**
(`/api/consent/:token`), not a Clerk session — the patient has no account. Only
the token's hash is stored (`patients.consentTokenHash`).

## Rules (learned the hard way in review)

- **Redact the token from logs.** It rides in the path, so the pino `req`
  serializer in `app.ts` must strip it (regex replace `/api/consent/<tok>` →
  `[redacted]`). Query-string stripping alone is not enough for path tokens.
  **Why:** request logging serializes `req.url`; a raw path logs the bearer
  credential.
- **Single-use.** Clear `consentTokenHash` (set null) in the same update that
  flips status to `consented`. **Why:** otherwise the emailed link stays a valid
  bearer credential forever — replayable to read patient PHI.
- **Risk is server-derived, never a client flag.** The intake safety gate
  (require safety-plan confirmation) keys off `deriveRiskFlag(data)` =
  `clinical.cssrsFlag || clinical.activeSuicidalIdeation`, computed from the
  validated intake blob. `riskFlag` is not accepted from the client. **Why:** a
  caller could otherwise submit an intake indicating suicidal ideation while
  claiming `riskFlag:false` to skip the gate. Intake `data` is a strict nested
  zod schema (screening scores range-checked: PG-13-R 0-50, PHQ-9 0-27,
  GAD-7 0-21), re-validated at the submit gate from the decrypted blob.
- **`/caregiver` is public marketing; the real PHI dashboard is authed at
  `/care/patients`.** The build spec said `/caregiver` should show real patients,
  but real linked-patient PHI must sit behind Clerk + 2FA — so it lives at
  `/care/patients` and `/caregiver` only links signed-in providers to it. This
  spec drift is intentional and security-preserving.
- **State machine is server-owned.** Intake `status` is NOT client-writable.
  Creation is always `draft`; only `POST /intakes/:id/submit` advances to
  `submitted` (it mints the token, creates the patient, sends the invite, and
  runs the safety gate). **Why:** accepting a client `status` lets callers reach
  `submitted` while skipping every side effect.

## Known gap (deferred, see follow-ups)
- Submit and e-sign are not wrapped in a DB transaction/lock, so concurrent
  requests can race and insert duplicate consent rows before the status guard
  trips. No token TTL/expiry yet.
