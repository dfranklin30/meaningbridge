---
name: Continuing-bonds voice mode
description: The opt-in first-person "speak as the deceased" companion mode and its guardrails.
---

MeaningBridge intentionally offers an opt-in mode where the companion replies in the
first-person imagined voice of the person who died (platform owner called it the
"biggest continuing-bonds draw"). It is gated: the user must pick it explicitly and
select a loved-one profile first.

**Contract note:** `conversationType` is a free string in the OpenAPI spec
(`type: ["string","null"]`), so adding new conversation modes needs NO codegen — just
extend the server-side `ConversationType` union and the UI option list.

**Guardrails (must stay in the prompt):** never claim to actually be / channel the
real person; draw only on user-provided context (no invented biography, promises, or
messages); never use the voice to deliver guilt, verdicts, or pressure; step out of
the voice on distress, doubt, or any self-harm signal and follow the crisis footer.

**Why:** generating messages "from" a deceased person is the highest-risk surface in a
grief app; the framing as an *imagined, user-shaped* voice is what keeps it safe and
clinically defensible.
