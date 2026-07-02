# Data retention, consent revocation & deletion

MeaningBridge handles two kinds of sensitive data under two consent models. This
document is the source of truth for how consent is withdrawn and how data is
retained or deleted. It is intentionally short and operational.

## What we store

- **Seeker (account holder) data** — the person's own journal entries, companion
  conversations, check-ins, and profile. Owned by the seeker; never visible to a
  clinician except through an active care relationship and the matching consent
  flag.
- **Professional-portal patient data (PHI)** — identifying fields a clinician
  enters for a patient (name, DOB, email, phone). Encrypted at rest. Access is
  granted only through `provider_patient_links` (single choke point:
  `artifacts/api-server/src/lib/patientAccess.ts`).
- **Audit log** — an append-only record of every sensitive read/write. Retained
  for compliance; never edited or deleted in normal operation.

## Consent model 1 — care relationships (seeker ↔ clinician)

- Consent is granular and opt-in (summaries / safety / engagement), controlled by
  the seeker.
- **Revocation:** `POST /api/care/connections/:id/revoke` (either party). On
  revocation the relationship status becomes `revoked` **and all three consent
  flags are cleared**, so no further data can reach the clinician even if the row
  were ever reopened. Effect is immediate.

## Consent model 2 — professional-portal patient (emailed consent link)

- The patient signs consent via a single-use emailed link. Signing mints a
  **durable, single-use withdrawal token** (`patients.withdraw_token_hash`, only
  the SHA-256 hash is stored).
- **Withdrawal / deletion:** `GET|POST /api/consent/withdraw/:token`. On
  withdrawal we, in one step:
  1. set the patient status to `revoked` (provider visibility stops — rosters
     show active patients only);
  2. record `consents.revoked_at`;
  3. **purge the encrypted PHI** on the patient row (first/last name, DOB, email,
     phone set to null) — this is the honored deletion;
  4. clear both the sign and withdrawal token hashes (single-use).
- The non-PHI shell (id, timestamps, status) and the audit trail are retained so
  the compliance record of "consent given, then withdrawn" stays intact.
- To return, the patient must be re-invited by their clinician (a fresh consent
  link).

## Provider-initiated deletion

A clinician may delete a patient outright via `DELETE /api/professional/patients/:id`,
which removes the patient row (and cascades its links/consents). This is audited.

## Verification

The minimum-necessary isolation guarantee is covered by an integration test:
`artifacts/api-server/test/patientAccess.test.ts` (run `pnpm --filter
@workspace/api-server test`). It proves a provider cannot read a patient they are
not linked to.
