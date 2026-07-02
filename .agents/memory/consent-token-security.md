---
name: Public consent-token & PHI intake security
description: Durable policy invariants for the patient e-sign bearer-token flow and provider intake, so tokens can't leak/replay and safety gates can't be bypassed.
---

# Consent-token & PHI intake invariants

The patient consent link is authed by a bearer token in the **URL path** (the
patient has no account/Clerk session). Only the token's hash is stored. These are
policy rules that survive refactors — grep the code for the current implementation.

## Bearer-token rules
- **Redact path tokens from logs.** The token rides in `req.url`, so the request
  logger must strip it. Query-string redaction alone is insufficient for a token
  in the path.
- **Single-use.** Invalidate the stored token hash in the same write that advances
  status on successful e-sign. **Why:** otherwise the emailed link is a permanent
  replayable credential to read PHI / re-sign.

## Outbound-link origin
- **Never build user-facing email links from request headers as the primary
  source.** Resolve the app origin from trusted config (explicit env override →
  platform deployment domain → dev domain), with request headers only as a
  last-resort local fallback. **Why:** an authed caller can spoof Host /
  X-Forwarded-Host and poison the consent-invite URL → token phishing/exfiltration.

## Safety gate & validation
- **Risk is server-derived, never a client flag.** The safety gate keys off risk
  computed from the validated intake blob (C-SSRS / active-SI signals), not any
  client-supplied `riskFlag`. **Why:** a client could otherwise report suicidal
  ideation yet claim low risk to skip the gate.
- **Validate the intake blob server-side with a strict nested schema** (not an
  open record), including numeric ranges for screening instruments, and
  **re-validate at the submit gate from decrypted storage** — not just on write.

## State machine (server-owned)
- Intake `status` and `riskFlag` are NOT client-writable. Creation is always a
  draft; only the submit endpoint advances state, and that same call mints the
  token, creates the patient, sends the invite, and runs the safety gate.
- **Email is mandatory at submit.** Submit is the only place the token is minted
  and the invite sent, so an email-less submit strands the patient in `invited`
  with no delivery path. Enforce server-side (400) and disable the client submit.

## `/caregiver` vs real dashboard
- `/caregiver` is **public marketing**; the real linked-patient PHI dashboard is
  authed (Clerk + 2FA) at a separate route. Real PHI must never sit on a public
  route even if a spec says so — intentional, security-preserving drift.

## Two consent models — don't conflate revocation paths
There are TWO distinct consent surfaces; revoking one does not touch the other.
- **Care relationship (seeker ↔ clinician):** revoke sets status `revoked` AND
  must clear all three consent flags (summaries/safety/engagement). **Why:**
  clearing status alone would still leak if the row were reopened.
- **Professional-patient e-sign:** signing mints a **durable, single-use withdraw
  token** (separate from the single-use *sign* token) stored as a hash on the
  patient row. Withdrawal (`/consent/withdraw/:token`, defined BEFORE `/:token`
  to avoid shadowing) purges the encrypted PHI fields (name/DOB/email/phone →
  null), sets status `revoked` + `consents.revokedAt`, and nulls both token
  hashes. **Why:** withdrawal is the honored deletion; the non-PHI shell + audit
  trail are retained as the compliance record. Operational details live in
  `docs/DATA_RETENTION.md`.

## Revocation must end visibility, not just clear PHI
Setting a patient to `revoked` and nulling PHI is NOT enough — the retained
`provider_patient_links` row still authorized the provider. All provider-facing
access must ALSO filter out closed statuses. `lib/patientAccess.ts` is the single
choke point: it hides `HIDDEN_STATUSES` (revoked, inactive) by joining
`patientsTable` in every helper (accessiblePatientIds / providerCanAccessPatient
/ getPatientForProvider / listPatientsForProvider). **Why:** we hide by status
rather than deleting the link so the relationship's compliance record survives;
a whitelist of `active` would wrongly hide legitimate draft/invited/consented
intake states.

## PHI is duplicated in the intake blob — purge it too
Patient identity PHI lives in TWO places: the `patients.*Enc` columns AND the
encrypted intake payload (`intakes.dataEnc`, under `data.identity`). Any
deletion/withdrawal that nulls the patient row MUST also purge the intake copy
(`lib/phiPurge.ts` purgeIntakePhiForPatient) or a provider can still read the
identity via `/professional/intakes/:id`. **How to apply:** whenever you add a
new store that copies patient PHI, wire it into the withdrawal purge and into the
revoked/inactive visibility filter (professionalIntakes mirrors patientAccess's
HIDDEN_STATUSES). **Why:** grep for every place `data.identity` / PHI is written,
not just the canonical patient row.

## Admin oversight routes need the 2FA gate too
The admin audit/export/metrics endpoints are mounted with the account-management
routers (before `phiGate`), so they do NOT inherit `requireTwoFactor`. They read
audit trails and aggregate PHI-scale counts, so each admin oversight route must
list `requireTwoFactor` inline after `requireAdmin`. **Why:** `requireTwoFactor`
only needs `req.userId` + an enrolled `provider_security` row, so it works for
admins without requiring `requireProfessional`/`requireVerifiedProvider` (which
would wrongly lock out non-provider admins). **How to apply:** any new
`/admin/*` route that touches PHI or audit data gets requireTwoFactor inline.

## Known gaps (deferred, see follow-ups)
- Submit + e-sign are not wrapped in a DB transaction/lock, so concurrency can
  race duplicate consent rows before the status guard trips.
- No token TTL/expiry, and no resend/refresh invite for changed-email recovery.
