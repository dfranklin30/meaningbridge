---
name: Image-chat body limit
description: Two independent choke points for base64 image attachments in JSON request bodies.
---
When a route accepts base64 image attachments inside a JSON body (e.g. companion vision chat), there are TWO independent limits to get right:

1. **Global body parser** — Express's default `express.json()` limit is 100kb. A realistic image (even ~200kb base64) is rejected at the parser BEFORE the route's own validation/size logic runs, so the in-route checks become dead code. Raise `express.json`/`express.urlencoded` limits in `app.ts` to fit the intended max (images × per-image cap).

2. **In-route decoded-size cap** — the browser's client-side size limit can be bypassed by a direct API caller, so the route must independently drop images whose *decoded* byte length (`Buffer.from(b64,"base64").length`, not base64 string length) exceeds the cap.

**Why:** a code review rejected a change that only added the in-route cap; the 100kb parser limit still silently broke real payloads.

**How to apply:** when testing, note that a hand-rolled test app with its own `express.json({limit})` will NOT catch a too-small limit in the real `app.ts`. Add at least one integration test that imports the real `app` (mock `@clerk/express` incl. a passthrough `clerkMiddleware`, and the AI integration) and posts a >100kb payload, asserting it reaches the route (e.g. 404 for a missing session) rather than a parser rejection (surfaced as 500 by the app's error handler).
