---
name: Outreach consent floor
description: The consent rule every proactive outreach/scheduling send path must honor, and why UI flags alone are not enough.
---

# Outreach consent floor

Every proactive send path (companion check-ins, task reminders, appointment
reminders) and every provider-initiated scheduling action must gate on the
patient's clinical consent state, NOT only on preference/UI flags.

- Allowed statuses for outreach/scheduling: `consented` and `active` only.
  Anything else (`draft`, `invited`, `revoked`, `inactive`) is suppressed.
- A user with NO linked patient enrollment is a self-serve seeker: their own
  outreach preferences (enable + pause) are their consent, so allow.
- A user linked to one or more patient records is allowed only if at least one
  enrollment is `consented`/`active`. Once all are `revoked`/`inactive`, outreach
  stops immediately.

**Why:** preference flags (`checkinsEnabled`, `taskRemindersEnabled`) are set once
and persist; they are not authority to keep messaging someone whose clinical
consent has ended. A prior review blocked the task because the scheduler sent on
flags alone. `getPatientForProvider` already hides revoked/inactive from provider
reads, but the scheduler queries prefs/tasks/appointments directly and bypassed
that choke point.

**How to apply:** any new proactive channel (SMS, etc.) or new scheduling path
must call the shared helpers, not re-check flags. Provider-visibility helpers are
NOT sufficient for outreach — the scheduler runs outside a request and reads
tables directly.
