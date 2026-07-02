---
name: Outreach delivery channels
description: Why outreach (email + SMS) uses env-var credentials with graceful degradation instead of Replit connectors, and how a new channel must behave.
---

# Outreach delivery channels

Proactive outreach sends through one seam (`deliverOutreach({channel, ...})`) and each concrete sender (email SMTP, SMS via Twilio) is configured by **plain env-var credentials** with **graceful degradation** — never a Replit connector, and never a silent fake send.

**Why:** the project deliberately dismissed the Replit Gmail OAuth connector in favor of a Gmail app password for the outreach subsystem; SMS follows the same convention (env-var Twilio REST via `fetch`, no SDK) for consistency and so the same deploy-time secret model applies to every channel. A Replit Twilio connector exists but is intentionally unused.

**How to apply:** when adding a channel, (1) read its config from env vars and, if unset, return a structured `{sent:false/delivered:false, error:"..._not_configured"}` so the scheduler logs a failure and keeps running — do NOT throw and do NOT fabricate success; (2) the scheduler resolves a per-channel destination before sending (SMS requires a verified phone, email an address) and a missing destination is a logged "skipped", not a crash; (3) quiet hours, cadence, pause, and the consent floor gate every channel identically — put those checks upstream of channel routing, not inside a single sender.

Note: both `GMAIL_*` and `TWILIO_*` are typically unset in the dev environment; the app runs fine because of the degradation above. They are configured at deploy time.
