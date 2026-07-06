# MeaningBridge

A warm, trauma-informed grief-support web app: Continuing Bonds and Meaning Reconstruction (Neimeyer) AI companions, journaling with prompts, self-guided practices, a self-assessment dashboard, a profile of the deceased loved one, a therapist locator, and crisis safety resources.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (proxied at `/api`)
- `pnpm --filter @workspace/meaningbridge run dev` — run the web app (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-practices` — seed/upsert the canonical practices (by slug), including breath-pacer patterns for breathwork practices
- Required env: `DATABASE_URL` (Postgres), Anthropic via Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + wouter + TanStack Query + framer-motion + recharts
- API: Express 5 (SSE streaming for chat)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- AI: Anthropic Claude Sonnet 4.5 via `@workspace/integrations-anthropic-ai`

## Where things live

- DB schema: `lib/db/src/schema.ts`
- API contract: `lib/api-spec/openapi.yaml`
- Generated client hooks: `lib/api-client-react/src/generated/api.ts`
- API routes: `artifacts/api-server/src/routes/` (anthropic, profile, chat, journal, assessments, practices, resources, dashboard, safety)
- System prompts (Continuing Bonds + Meaning Reconstruction): `artifacts/api-server/src/lib/prompts.ts`
- Web pages: `artifacts/meaningbridge/src/pages/`
- Shared layout, header, crisis affordance, onboarding gate: `artifacts/meaningbridge/src/components/layout.tsx`
- Theme tokens, fonts: `artifacts/meaningbridge/src/index.css`

## Architecture decisions

- Single-user MVP. No auth. Profile is a single auto-created row.
- Chat streams via SSE (`text/event-stream`) using `anthropic.messages.stream` and `content_block_delta` events. The client uses `fetch` + manual `ReadableStream` parsing of `data: {json}` frames with event types `delta | crisis | done | error`.
- Crisis detection runs on every user message. Matches log a `safety_event` and surface a soft, non-alarming card linking to `/crisis`.
- Onboarding gate lives in the shared layout: if `profile.onboardingComplete === false`, redirect to `/onboarding` (except `/onboarding` and `/crisis`).
- Drizzle `deceased.lossDate` uses `mode: "string"` and the profile route normalizes Zod-coerced `Date` back to ISO date strings before insert.

## Clinical model (GIS + tier routing)

- GIS = Grief Impairment Scale (Lee & Neimeyer, Death Studies 2022). 5 items, 0-4 days-per-30 scale, total 0-20. Public domain with citation.
- Tier mapping (configurable in `artifacts/api-server/src/lib/clinical.ts`): 0-4 Universal, 5-8 Targeted, ≥9 Clinical (validated cut-score).
- Safety triggers escalate regardless of total: GIS item 3 ≥ 2 (self-destructive coping) and item 5 ≥ 3 (social withdrawal). Both log a `safety_event` and divert the onboarding flow to a calm crisis prompt — never silently scored.
- Companion system prompts in `artifacts/api-server/src/lib/prompts.ts` are tier-aware (Section D of the build spec). They receive `{ profile, deceased }` and inject `firstName` + tier-specific behavior. Hard limits: never claim to be human/therapist, never name self-harm methods, never state cut-scores to the user.
- UI rule: "shift from numbers to narratives." The tier is surfaced as a warm sentence on the dashboard; the numeric GIS score is never shown to the user.
- Clinical wording lives in two mirrored modules — server (`artifacts/api-server/src/lib/clinical.ts`) is source of truth for scoring/tier; client (`artifacts/meaningbridge/src/lib/clinical.ts`) carries item wording and the scale for rendering.

## Product

Public (no onboarding gate, no app chrome):
- `/` — coming-soon landing: centered hero — headline, then two big horizontal audience doorways front-and-center around the infinity ribbon (left navy "For professionals" → `/caregiver`, right teal "For those grieving" → `/sign-up`), then "Brought to you by Dr. Robert Neimeyer", a quiet "Or notify me at launch", and the contact line for neimeyer@portlandinstitute.org. The doorways use the `brand-navy`/`brand-teal` (primary) tokens to echo the logo's two loops (mobile menu carries the same two boxes). A "Community of interest" section (anchor `#community`, linked from the nav) invites people to the Portland Institute for Loss and Transition Facebook community at https://www.facebook.com/PortlandInstitute/. The QR code was removed from the homepage (still lives on `/notify` and `/present`).
- `/notify` — public signup form (writes to `notify_opt_ins`). Reads `?src=<label>` for attribution; defaults to `qr`.
- `/present` — full-screen QR for keynote projection.
- `/demo` — public, no-login guided tour of every feature (self-contained; no auth/firewall). Two audience sections ("For those grieving" teal, "For professionals" navy), each a numbered list of features with a plain-language explanation and an on-brand illustrative example (representative visuals rendered with the design system, not live data). Linked from the landing nav ("See the demo", desktop + mobile). Lives in the public router switch in `App.tsx`. Closing CTAs route to `/sign-up` and `/caregiver`.
- `/pricing` — subscription tiers mapped to the GIS tiers (Companion / Enhanced / Specialist). Visual prototype, no Stripe wiring; CTAs route to `/onboarding` or `/notify?src=pricing-*`.
- `/caregiver` — caregiver (therapist) portal preview with sample data. Roster, tier badges, consent indicator, per-patient briefing, safety counts. Clearly labeled "preview with sample data" — no PHI, no real data wired. The three "How it works" stage cards are live entry points: signed-in clinicians go to `/care/intake` (stage 1) and `/care/patients` (stage 3) — each destination self-gates on clinician verification/2FA; signed-out visitors route to `/notify?src=caregiver-*`. Stage 2 always opens `/consent/preview`.
- `/consent/:token` — patient consent screen. The sentinel token `preview` (`/consent/preview`) renders a no-network preview: sample info, a "nothing here is saved" banner with a link back to `/caregiver`, and a client-only success state on submit (no API GET/POST). `/consent/withdraw/:token` is registered before `/consent/:token` so it is not shadowed.

The /pricing and /caregiver routes are in the public-routes set in `layout.tsx` so they bypass the onboarding gate, and link to each other plus `/notify` for waitlists.

App (behind onboarding gate, full chrome) lives at `/app` plus: `/onboarding`, `/companion`, `/companion/:sessionId`, `/journal`, `/journal/new`, `/journal/:id`, `/practices`, `/practices/:id`, `/checkin`, `/reflections`, `/reflections/gmri`, `/dashboard`, `/loved-one`, `/therapists`, `/community`, `/community/:slug`, `/crisis`, `/settings`, 404.

## Community (peer chat rooms)

- Screen-name-only peer support rooms. REST (`routes/community.ts`) handles identity + room listing/join/leave + reporting + moderator review; live messaging is Socket.IO (`lib/communityRealtime.ts`, mounted under `/api/socket.io`, Clerk-cookie handshake). Not in the OpenAPI spec — the frontend (`pages/community.tsx`) uses manual `fetch` + `socket.io-client`, no generated hooks.
- Rooms are both curated (seeded by slug via `scripts/seed-community.ts`, `createdByUserId` null) and member-created. `POST /community/rooms` lets any member with a screen name open a room: name 3-60 chars, optional description ≤200, slug generated + de-duped (`-2`, `-3`…), name+description run through the same `moderate()`/`detectCrisis()` safety net as messages (crisis/flagged → 422, never created), gentle cap of 15 rooms per creator, creator auto-joins. Member rooms sort after curated (sortOrder 1000) and snapshot the creator's screen name (`createdByScreenName`) for a calm "Started by …" tag. `slugToRoomId` resolves any room dynamically, so new rooms work over Socket.IO immediately with no realtime change.
- Every inbound message is safety-screened before broadcast: crisis language is never shared (sender privately gets the 988 card, auto moderator flag), other harmful content is blocked with a kind private note. Moderator review view is gated to `isProfessional`.

## Reflective inventories (GMRI)

- GMRI is offered as an interactive, reflective self-reflection under `/reflections`. It is REFLECTIVE only: it does NOT reassign the GIS care tier and does NOT fire safety events. GIS remains the sole triage/safety instrument.
- It reuses the `screener_results` table (instrument + `itemResponses` + `subscaleScores`) — no schema change. Scoring is the server's job (`artifacts/api-server/src/lib/clinical.ts`); the client (`artifacts/meaningbridge/src/lib/clinical.ts`) mirrors item wording + narratives for rendering.
- Endpoints: `POST/GET /api/assessments/gmri` (auth-gated, in `routes/assessments.ts`).
- GMRI (Grief & Meaning Reconstruction Inventory, Neimeyer, Appendix 9.1): 29 items, 1-5. Five factors — continuingBonds, personalGrowth, senseOfPeace, emptiness (reverse-scored 6−raw), valuingLife. Submits `{responses:int[29]}`; result returns factor means (1-5, all oriented higher=healthier) + total (29-145). Results view: animated recharts Radar + per-factor warm narrative bands (`gmriBand`). Item 16 ("I've lost my innocence") carries the author's clarifying second sentence: "I am less naive about life as a result of this loss."
- Shared runner: `components/inventory-runner.tsx` (one-item-at-a-time, framer-motion fades, progress, back nav). Dashboard shows a compact GMRI radar snapshot when data exists.
- IDWL (Inventory of Daily Widowed Life) was removed at the author's request — it is not the team's instrument to distribute. Per Dr. Neimeyer, GIS and the ISLES-SF are the intended basic "outcome" measures, with the Grief Attack Questionnaire (GAQ) and Unfinished Business in Bereavement Scale (UBBS) as candidate additions (possibly Premium-gated). None of these are wired yet — they require the authors' exact validated item wording and response scales before implementation; do NOT fabricate clinical items.

## Notify signups

- Table: `notify_opt_ins(id, email UNIQUE, first_name, role_interest, source default 'qr', created_at)`.
- `POST /api/notify` upserts (returns `alreadySubscribed: true` on duplicate — no error UX). Accepts optional `firstName` (trimmed to first whitespace-delimited token).
- `GET /api/notify` returns the full list for CSV export.
- Two fire-and-forget emails go out on each new (non-duplicate) signup:
  1. **Internal notification** — To: remcrawfordresearch@gmail.com, danielle@techleadershipcommunity.com, neimeyer@memphis.edu. Cc: neimeyer@portlandinstitute.org (on Cc so that mailbox's filters can auto-copy/forward incoming signups). Reply-to = signup email so recipients can reply directly. Includes the first name in the table.
  2. **Confirmation to the signup** — To: signup email. Reply-to = neimeyer@portlandinstitute.org (a real human, not the SMTP sender mailbox). Subject "You are on the list for MeaningBridge". Greeted by first name if provided ("Hello Danielle,"), otherwise "Hello,". Warm copy about the experience being shaped around them and the person they are remembering, signed by "The MeaningBridge team".
- Email is sent via `nodemailer` + Gmail SMTP using `GMAIL_USER` / `GMAIL_APP_PASSWORD` secrets (the Replit Gmail OAuth connector was dismissed in favor of an app password). Helper: `artifacts/api-server/src/lib/mailer.ts`. The API response never waits on SMTP.
- QR is generated client-side with the `qrcode` npm package (privacy + reliability), encoded as `${window.location.origin}/notify?src=qr` so it works on dev and deployed domains without hard-coding.
- Notification emails embed the MeaningBridge lockup logo inline via `cid:meaningbridge-logo` (nodemailer attachment with `cid`). The PNG is loaded once at startup from `artifacts/api-server/assets/logo.png`.

## Proactive outreach (email + SMS)

- Outreach (companion check-ins + task reminders) flows through a channel seam: `artifacts/api-server/src/lib/outreachChannel.ts` (`deliverOutreach({channel, to, subject, text, html})`). Email and SMS are both live. Any other channel returns `delivered:false` with a reason — never a silent fake send.
- SMS uses Twilio's REST API via `artifacts/api-server/src/lib/smsSender.ts`, configured by `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (a `+E.164` number, or a `MG...` Messaging Service SID). Mirrors `mailer.ts`: degrades gracefully to `{sent:false, error:"sms_not_configured"}` when unset, so the scheduler logs a failure and never crashes. No Twilio SDK dependency — plain `fetch`.
- Per-user prefs live in `outreach_preferences`: `channel` (`email`|`sms`), verified `phone` + `phoneVerifiedAt`, and in-flight verification fields (`pendingPhone`, hashed `verificationCodeHash`, `verificationExpiresAt`, `verificationAttempts`). Codes are 6-digit, 10-min TTL, hashed (never stored/logged in clear), max 5 attempts.
- Phone verification endpoints (auth-gated, in `routes/companion.ts`): `POST /companion/outreach/phone/start` (normalizes to E.164, texts a code), `POST /companion/outreach/phone/verify`, `DELETE /companion/outreach/phone` (forgets number + reverts channel to email). Setting `channel:"sms"` is rejected server-side unless a phone is verified.
- The scheduler (`scheduler.ts`) routes each send by `channel` via `resolveTarget`: SMS needs a verified phone, email needs an address; a missing destination logs a "skipped" with a reason. Quiet hours, cadence, pause, and the consent floor apply identically to both channels. SMS bodies are short calm plain-text versions of the email bodies. Appointment reminders (provider→patient PHI) remain email-only.
- UI: `artifacts/meaningbridge/src/components/outreach-settings.tsx` has an email/SMS picker plus a capture→send-code→verify flow (and remove-number). The numeric GIS-style clinical rules are unaffected.

## Voice & photos (per-user)

- Voice-to-text: shared `VoiceInput` component (`artifacts/meaningbridge/src/components/voice-input.tsx`) used in companion chat (`pages/companion/session.tsx`) and journal editor (`pages/journal/editor.tsx`). Records with `useVoiceRecorder` from `@workspace/integrations-openai-ai-react`, POSTs the blob as multipart field `audio` to `/api/voice/transcribe` (server uses OpenAI STT, `routes/voice.ts`, multer memory 25MB, `requireAuth`), then inserts the returned `.text` into the field for review before send/save. Calm states (recording pulse, transcribing) plus mic-permission-denied and transcription-failure fallbacks. Recording auto-stops on unmount; the stop affordance stays active even while chat is streaming.
- Photo uploads: `PhotoGallery` (`artifacts/meaningbridge/src/components/photo-gallery.tsx`) on the loved-one page, shown only when a deceased profile exists. Uses `useUpload` from `@workspace/object-storage-web` with `basePath` `${import.meta.env.BASE_URL}api/storage`. Flow: request presigned URL → PUT to storage → POST `{objectPath}` to `/api/deceased/:id/photos`. Images served at `${BASE_URL}api/storage{objectPath}` (objectPath is `/objects/<id>`). Delete via `DELETE /api/deceased/photos/:photoId`.
- Auth/ACL: object storage upload + private object serving are behind `requireAuth`; serving checks READ via `canAccessObjectEntity` with the Clerk `userId`. Attaching a photo uses `objectStorageService.claimObjectEntity` which refuses to reassign an object already owned by a different user (no cross-user takeover) before setting ACL owner = userId, visibility private. Deleting a photo also deletes the underlying blob (`deleteObjectEntity`) so a previously known URL can no longer serve it. Photos table `deceased_photos(id, userId, deceasedId, objectPath, createdAt)` is scoped to the user with cascade delete (`lib/db/src/schema/deceasedPhotos.ts`).
- Auth is cookie-based same-origin Clerk, so manual `fetch` and the upload hook carry the session automatically — no Authorization header needed (same pattern as the SSE chat fetch).

## Brand assets

- The homepage film section is a carousel (`components/film-carousel.tsx`, rendered under the hero on `/`): the 30-sec teaser (`src/assets/teaser-film.mp4`) and the opening film (`src/assets/hero-film.mp4`) are self-hosted, autoplay muted, and carry a sound on/off toggle (sound resets on clip change). The rest are Dr. Neimeyer's YouTube talks — a thumbnail with a play overlay that swaps to a youtube-nocookie iframe on click. Prev/next arrows + a thumbnail rail; self-hosted clips use navy/teal gradient tiles.
- The homepage background (`components/living-background.tsx`) draws navy/teal aurora orbs plus a faint animated infinity ribbon (lemniscate SVG path) with two soft lights travelling its loops — the continuing bond / bridge between two worlds. Honors `prefers-reduced-motion` (renders at rest).
- Source PNG with whitespace trimmed: `artifacts/meaningbridge/src/assets/brand/meaningbridge-mark.png` (infinity-bridge mark, 787x340) and `artifacts/meaningbridge/src/assets/brand/meaningbridge-lockup.png` (mark + wordmark, 957x535). Both are RGBA with transparent background.
- `<Logo variant="lockup" size={N} />` renders the full lockup at height `N`. `<Logo />` (default) renders just the infinity mark; pass `withWordmark` to append the serif text wordmark instead of the image lockup.
- Favicon: `artifacts/meaningbridge/public/favicon.png` + `favicon.ico` (multi-size 16/32/48/64), generated from the mark. The legacy `favicon.svg` is no longer linked.
- Open Graph / Twitter card: `artifacts/meaningbridge/public/opengraph.jpg` (1200x630) — cream gradient with centered lockup and serif tagline. Referenced by absolute `/opengraph.jpg` in `index.html`.
- Email notification logo: `artifacts/api-server/assets/logo.png` (a copy of the mark) — loaded at startup and embedded inline with `cid:meaningbridge-logo`.

## User preferences

- NO emojis anywhere in UI. None.
- Calm, restful tone. No gamification, no exclamation points.
- Newsreader (editorial serif) for headings, Inter for body — calm, editorial, Aesop-inspired. (Superseded earlier Nunito/Nunito Sans, Playfair/DM Sans, and Fraunces/Inter.)
- Palette is derived from the logo (navy→teal infinity-bridge): deep navy (`--brand-navy`) = the professionals loop, bridge teal (`--brand-teal` / `--primary`) = the grieving loop, on cool soft paper. The two brand tokens are exposed as `brand-navy`/`brand-teal` Tailwind utilities. The landing audience doorways and the animated infinity ribbon use them to express the integration between professionals and those grieving.
- Tasteful slow motion (framer-motion fades). No bounce, no overshoot.
- Persistent crisis-support affordance on every screen.

## Gotchas

- Express 5: route handlers must use `res.status(...).json(...); return;` pattern, not `return res.status(...)`.
- All Tailwind/PostCSS `@import` lines must come before `@plugin` and `@custom-variant` in `index.css`.
- Frontend fetches must prefix URLs with `import.meta.env.BASE_URL` (the artifact base path).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
