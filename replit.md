# MeaningBridge

A warm, trauma-informed grief-support web app: Continuing Bonds and Meaning Reconstruction (Neimeyer) AI companions, journaling with prompts, self-guided practices, a self-assessment dashboard, a profile of the deceased loved one, a therapist locator, and crisis safety resources.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (proxied at `/api`)
- `pnpm --filter @workspace/meaningbridge run dev` — run the web app (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
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
- `/` — coming-soon landing: headline, "Brought to you by Dr. Robert Neimeyer", QR code linking to `/notify?src=qr`, copy-link, contact line for neimeyer@portlandinstitute.org, link to `/present`.
- `/notify` — public signup form (writes to `notify_opt_ins`). Reads `?src=<label>` for attribution; defaults to `qr`.
- `/present` — full-screen QR for keynote projection.
- `/pricing` — subscription tiers mapped to the GIS tiers (Companion / Enhanced / Specialist). Visual prototype, no Stripe wiring; CTAs route to `/onboarding` or `/notify?src=pricing-*`.
- `/caregiver` — caregiver (therapist) portal preview with sample data. Roster, tier badges, consent indicator, per-patient briefing, safety counts. Clearly labeled "preview with sample data" — no PHI, no real data wired.

The /pricing and /caregiver routes are in the public-routes set in `layout.tsx` so they bypass the onboarding gate, and link to each other plus `/notify` for waitlists.

App (behind onboarding gate, full chrome) lives at `/app` plus: `/onboarding`, `/companion`, `/companion/:sessionId`, `/journal`, `/journal/new`, `/journal/:id`, `/practices`, `/practices/:id`, `/checkin`, `/dashboard`, `/loved-one`, `/therapists`, `/crisis`, `/settings`, 404.

## Notify signups

- Table: `notify_opt_ins(id, email UNIQUE, role_interest, source default 'qr', created_at)`.
- `POST /api/notify` upserts (returns `alreadySubscribed: true` on duplicate — no error UX).
- `GET /api/notify` returns the full list for CSV export.
- Recipients intended for notification on each signup: remcrawfordresearch@gmail.com, danielle@techleadershipcommunity.com, neimeyer@memphis.edu, neimeyer@portlandinstitute.org. Actual email send is NOT wired — both Gmail and SendGrid integrations were dismissed by the user. The route currently logs the signup with the recipient list; wire `sendEmail` from whichever integration the user enables.
- QR is generated client-side with the `qrcode` npm package (privacy + reliability), encoded as `${window.location.origin}/notify?src=qr` so it works on dev and deployed domains without hard-coding.

## User preferences

- NO emojis anywhere in UI. None.
- Calm, restful tone. No gamification, no exclamation points.
- Playfair Display for display, DM Sans for body.
- Tasteful slow motion (framer-motion fades). No bounce, no overshoot.
- Persistent crisis-support affordance on every screen.

## Gotchas

- Express 5: route handlers must use `res.status(...).json(...); return;` pattern, not `return res.status(...)`.
- All Tailwind/PostCSS `@import` lines must come before `@plugin` and `@custom-variant` in `index.css`.
- Frontend fetches must prefix URLs with `import.meta.env.BASE_URL` (the artifact base path).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
