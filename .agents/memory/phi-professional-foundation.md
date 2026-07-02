---
name: PHI / professional-portal data foundation
description: Durable decisions for storing real PHI in the professional/provider domain (encryption, tokens, access control)
---

# PHI storage decisions (professional portal)

The professional/provider domain stores **real PHI** (private pilot). Durable rules:

- PHI columns use an `Enc` suffix and hold AES-256-GCM ciphertext produced by the
  helper in `artifacts/api-server/src/lib/phi.ts`. Non-PHI metadata is plain.
  Anything storing a person's identity/health detail must go through `encryptPhi*`.
  **Why:** limits blast radius if the DB is exposed; "minimum necessary" posture.

- The encryption key lives in the app-managed env var `PHI_ENCRYPTION_KEY`
  (set via `setEnvVars`, NOT the Replit secrets store). This deviates from the
  environment-secrets skill on purpose — it is an app-managed data key. The helper
  throws loudly if the key is missing/invalid rather than silently degrading.

- Bearer credentials are never stored in plaintext. The consent-link token is
  stored only as a SHA-256 hash (`patients.consentTokenHash`); the raw token is
  emailed once and never persisted. Mint/verify via
  `artifacts/api-server/src/lib/consentToken.ts`. Apply the same hash-only pattern
  to any future token/secret column.
  **Why:** a token is a password-equivalent; plaintext storage lets DB exposure
  grant consent-signing ability.

- Provider→patient authorization goes ONLY through `provider_patient_links` rows
  (`lib/patientAccess.ts` / `getPatientForProvider` returns null for both
  unauthorized and missing, so it can't be used to enumerate patient IDs). `isAdmin`
  is an orthogonal boolean, not routed through these link helpers.
