---
name: Companion daily greeting
description: How the personalized dashboard login greeting is generated, constrained, and cached.
---

# Companion daily greeting

The seeker dashboard opens with a warm, personalized companion greeting card
(name + one gentle next step), built from the person's own data (companion
memory, recent journal title, days-since-last-visit) via the existing AI seam.

**Rule: generated user-facing copy must be constrained deterministically, not just by prompt.**
- **Why:** replit.md hard rules (no emojis, no exclamation points, never surface
  numeric scores/streaks) cannot be trusted to a single model turn; a violation
  would otherwise be cached and shown all day.
- **How to apply:** any new generated-copy surface must strip `!`, and reject
  emoji + any digit before persisting/showing. On rejection or model outage,
  return a calm templated fallback (personalized only by known name) and do NOT
  cache it, so a later load can still get a real generation.

**Rule: per-day cached generations must re-read the persisted row before returning.**
- **Why:** two concurrent first-of-day requests both miss the cache and generate
  different drafts; `onConflictDoNothing` keeps one row but each caller would
  otherwise return its own draft, so same-day clients disagree.
- **How to apply:** after the conflict-safe insert, SELECT the `(userId, dateKey)`
  row and return that, so everyone converges on the stored winner.

**Reuse the existing aiProvider seam, never the OSS package's raw NVIDIA fetch.**
- The app already reaches NVIDIA Nemotron through the Replit OpenRouter
  integration with an Anthropic fallback. `companionComplete` (non-streaming JSON)
  mirrors `professionalComplete` but on `COMPANION_MODEL`. The direct
  `NVIDIA_API_KEY` secret is unused by this path.
