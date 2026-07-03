---
name: Safety-event routing (what belongs in safety_events)
description: Which companion guardrail outcomes may be written to safety_events, and why off-topic must not be.
---

Only genuinely safety-relevant guardrail outcomes may be written to `safety_events`:
crisis (regex ∪ moderation self-harm → severity `critical`, source `chat`) and
harmful non-self-harm moderation flags (source `guardrail`, severity `warning`),
plus fire-and-forget model-output moderation flags. **Benign "off-topic" redirects
must NOT be written to `safety_events`** — log them via `req.log.info` for
observability instead.

**Why:** `safety_events` is a live clinical signal, not a generic guardrail log.
The user's own settings page renders every row as a "Safety Event" with a
severity badge, and the clinician patient view derives `safetyEventCount` /
`openSafetyEventCount`, the latter driving a "consider reaching out" nudge.
Writing benign off-topic redirects there pollutes the user's calm safety feed and
inflates the clinician's safety count with non-safety noise, degrading the core
triage signal. A code reviewer may push to "log all guardrail events to
safety_events" — resist for off-topic specifically; it is a product-safety
regression, not compliance.

**How to apply:** When adding any new companion guardrail, ask "is this a safety
signal a clinician should act on?" If no (topic control, formatting, rate limits),
log to the app logger, never to `safety_events`.

Related: content moderation (`lib/safety.ts` `moderate()`) FAILS OPEN — if the
OpenAI moderation call errors or is unconfigured it returns not-flagged
(`degraded:true`) and logs; the regex crisis net in `crisis.ts` remains the hard
floor. A grief app must never refuse to listen because a network call failed, and
must never block legitimate death/loss talk.
