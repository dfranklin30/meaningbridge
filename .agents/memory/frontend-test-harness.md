---
name: MeaningBridge frontend test harness
description: How Vitest is set up for the meaningbridge web app and why it needs its own config.
---

# MeaningBridge frontend test harness

The `meaningbridge` web app has a Vitest + React Testing Library + jsdom harness
(`pnpm --filter @workspace/meaningbridge test`). Tests live in
`artifacts/meaningbridge/test/`.

**Why a standalone `vitest.config.ts` (not the app's `vite.config.ts`):** the
app's `vite.config.ts` throws at load time if `PORT` / `BASE_PATH` env are
missing (they are workflow-provided). Tests run without those, so the harness has
its own minimal config that only mirrors the `@` alias and the React plugin.

**How to apply:** component tests mock `@workspace/api-client-react` (the
generated hooks) with `vi.mock` + `vi.hoisted` fixtures, and wrap the component
in a real `QueryClientProvider` because pages call `useQueryClient`. Mock
`wouter`'s `useRoute` when a page reads route params. Asset imports (brand PNGs
in `Logo`) resolve fine through the vite transform.
