---
name: Healthie booking PHI boundary
description: How the Healthie booking slice keeps PHI/keys out of our stack; deny-by-default gate posture.
---

# Healthie booking PHI boundary

The Healthie API key is privileged and must stay server-side. The browser never
issues raw GraphQL — each seeker-facing operation is a fixed, validated Express
route (`/api/booking/*`) that owns its hardcoded query and calls the shared
server transport. This is the choke point that keeps arbitrary GraphQL (and the
key) out of the client.

**Why:** Healthie is the HIPAA system of record. A client-exposed key or a
pass-through GraphQL endpoint would leak PHI and let the browser read/write any
patient data. Our Postgres holds only the non-PHI `users.healthieUserId` FK.

**How to apply:**
- Never log Healthie query variables, response bodies, or GraphQL error text —
  they can restate submitted PHI. Log only non-PHI metadata (status, errorCount,
  safe class name). Non-2xx bodies may echo the request, so log status only.
- The booking gate fails **closed**: no required-forms env configured → denied;
  user not linked (no `healthieUserId`) → denied; forms configured but signed set
  incomplete → denied. The server re-checks eligibility before `completeCheckout`;
  the client pre-gate is convenience only, never authoritative.
- The `formAnswerGroups(finished: true)` gate query shape is best-effort from
  Healthie docs — verify against the sandbox once `HEALTHIE_API_KEY` is provided.
- Missing key surfaces as `HealthieNotConfiguredError` → route returns 503; other
  transport/GraphQL failures throw `HealthieError` with client-safe messages.
