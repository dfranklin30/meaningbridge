---
name: Generated API client base URL
description: The Orval-generated React client is not BASE_URL-aware unless setBaseUrl() is called at bootstrap; MeaningBridge relies on being root-mounted.
---

# Generated API client and BASE_URL

`lib/api-client-react/src/custom-fetch.ts` prepends a base URL only when
`setBaseUrl()` has been called (otherwise `applyBaseUrl` is a no-op and the
request stays root-relative, e.g. `/api/journal`).

The MeaningBridge web app **never calls `setBaseUrl()`**. Generated hook calls
therefore go to absolute `/api/...`. This works only because the artifact is
mounted at root (`import.meta.env.BASE_URL` === `/`). Manual `fetch` calls
(voice, SSE chat, storage/photos) prepend `import.meta.env.BASE_URL` themselves,
so they are correct regardless.

**Why:** if this app is ever served under a sub-path prefix, every generated
hook request (journal, profile, assessments, etc.) will 404 ("not found")
while the manual fetches keep working — an easy-to-misdiagnose split.

**How to apply:** when moving off a root mount, call
`setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, ""))` once at frontend
bootstrap so generated calls resolve under the base path.

## Journal-save debugging conclusion (for future "saving doesn't work" reports)
The save path was verified working end-to-end: a rolled-back DB insert with the
exact handler values succeeded, schema/columns/defaults are present, requireAuth
GET returns 200 in-session, routes are ordered correctly, and `customFetch`
treats 201 as success. The real gap was diagnosability: there was no Express
error handler (thrown async errors returned an opaque 500 with no log) and the
journal editor's save `catch` only `console.error`'d, so failures were silent.
Both were fixed (centralized error middleware + visible `saveError` UI).
