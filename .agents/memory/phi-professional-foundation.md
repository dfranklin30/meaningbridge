---
name: PHI / professional-portal data foundation
description: Durable decisions for storing real PHI in the professional/provider domain (encryption, tokens, access control)
---

# PHI storage decisions (professional portal)

The professional/provider domain stores **real PHI** (private pilot). Durable rules:

- PHI columns use an `Enc` suffix and hold AES-256-GCM ciphertext; non-PHI
  metadata stays plaintext. Anything holding a person's identity or health
  detail must be encrypted on write and only decrypted through the centralized
  read serializers — never returned raw and never logged.
  **Why:** limits blast radius if the DB is exposed ("minimum necessary").

- The encryption key (`PHI_ENCRYPTION_KEY`) must be provisioned ONLY as a
  runtime **secret**, requested from the user via `requestEnvVar`. The agent
  never generates, sets, or knows its value, and it must NEVER be written into
  tracked config (`.replit`, committed env files) or `setEnvVars`.
  **Why:** an earlier design stored it as an app-managed env var and it ended up
  committed to `.replit`, which failed security review. Treat the data key like
  any other credential. The crypto helper throws loudly if the key is
  missing/invalid rather than silently degrading.
  **How to apply:** for local testing pass a throwaway key inline
  (`PHI_ENCRYPTION_KEY=... node ...`); for real runs rely on the provisioned
  secret.

- Bearer credentials are never stored in plaintext. The consent-link token is
  persisted only as a SHA-256 hash; the raw token is delivered once and never
  stored. Apply the same hash-only pattern to any future token/secret column.
  **Why:** a token is a password-equivalent; plaintext storage lets DB exposure
  grant consent-signing ability.

- Provider→patient authorization goes ONLY through the provider-patient link
  rows, via helpers that return null for both unauthorized and missing (so they
  can't enumerate patient IDs). Admin is an orthogonal flag, not routed through
  those link helpers. Every patient CRUD and PHI read must emit an audit entry.
  **Why:** provider-scoped access + audit is the core access-control invariant
  for PHI; a handler that skips the link check or the audit is a defect.
