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

## Product

Routes: `/`, `/onboarding`, `/companion`, `/companion/:sessionId`, `/journal`, `/journal/new`, `/journal/:id`, `/practices`, `/practices/:id`, `/checkin`, `/dashboard`, `/loved-one`, `/therapists`, `/crisis`, `/settings`, 404.

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
