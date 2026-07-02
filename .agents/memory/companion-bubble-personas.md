---
name: Companion bubble personas & PHI boundary
description: How the always-on corner chat bubble picks its persona and why the provider persona must stay PHI-free.
---

# Companion bubble personas

The always-on corner chat bubble (`components/companion-bubble.tsx`) serves three
personas, chosen by **route + capability**, not by `activeSpace`:
- signed-out → concierge (public product Q&A)
- signed-in + path starts `/care` or `/admin` **and** `isProfessional` → provider
- otherwise → seeker (grief companion)

**Why route-based, not activeSpace:** a dual-role account can deep-link to a
provider URL without flipping its active space; route detection keeps the persona
correct regardless. The `isProfessional` guard is mandatory — a non-professional
who lands on a `/care` URL must never get the provider persona.

**Why the provider persona must be PHI-free:** the provider bubble talks to
`/professional/general-assistant` (a stateless, general-help endpoint whose system
prompt forbids patient data). It must NEVER reuse the seeker chat-session path or
any patient-scoped route. Persona transcripts are reset on persona change so a
provider never sees a seeker's conversation and vice versa.

**Transport split:** seeker uses real server chat sessions (crisis detection +
memory, sessionId in localStorage, rehydrate via GET). Concierge and provider are
stateless — the client sends the full `messages[]` each turn.

**How to apply:** any new persona or entry point must keep the PHI firewall
(separate general endpoint, no patient payload) and reset transcript on switch.
