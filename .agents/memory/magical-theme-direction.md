---
name: Magical theme direction + sandbox roadmap
description: The agreed reinterpretation of the user's "Disney magical" request, and the phased plan for the large multi-part request.
---

# "Disney magical" theme decision

The user asked to make MeaningBridge feel "Disney magical." When offered options, the user chose a **gentle reinterpretation**: warmth, light, and hope — calm and adult, keeping the trauma-informed tone. This is explicitly **NOT** literal Disney whimsy, sparkle, mascots, or gamification.

**Why:** The brand is a grief-support product with strict calm/no-gamification/no-emoji preferences (see `replit.md`). Literal Disney magic would clash with the trauma-informed voice. The user confirmed the softer reading.

**How to apply:** Express "magic" as soft dawn light and quiet hope. Implemented via a `--dawn` gold token, a `.dawn-glow` utility, and a subtle gold radial layered into the shared `LivingBackground`. Keep it sparing and ambient — never a spotlight.

# Copy constraint reminder

The user preference "no emojis/symbols" is enforced strictly in review: the code-review architect flags typographic symbols like the em dash and middle dot in user-facing sandbox copy, even though older pages (landing, caregiver footers) still use em dashes. For **new** sandbox / AI-voice copy, prefer plain punctuation (commas, periods) and avoid em dash and middle dot. AI-companion sample text must contain no symbols at all.

# Large request roadmap (5 phases)

The big request (all six parts confirmed by the user) is sequenced in `.local/session_plan.md`:
- **P1 (DONE):** Playable `/sandbox` demo for both patient and therapist roles, capabilities-on-entry, quantitative + narrative feedback survey (`sandbox_feedback` table, public `POST /api/feedback`, token-gated `GET`), warm theme.
- **P2:** Interactive AI journal — privacy (Private/Shared/Share-Later), AI reflection with guardrails, crisis levels 0-4, clinician alerts tied to existing care consent.
- **P3:** Continuing Bonds — multiple loved-one profiles + guided conversation types + prompt builder.
- **P4:** Ground the AI in the attached Neimeyer clinical corpus (44 docs in `attached_assets/Archive_1782919778913.zip`), framework front-and-center.
- **P5:** Multimodal voice/photo reach across the app.

Two spec docs are attached in `attached_assets/` (Continuing Bonds + Interactive AI Journal `Pasted-*.txt`).
