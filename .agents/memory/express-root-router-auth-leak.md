---
name: Express root-mounted router auth leak
description: Why root-mounted Express routers must use per-route auth, not router.use(requireAuth)
---

When two Express routers are both mounted at the root path (`app.use(routerA)` and `app.use(routerB)` with no path prefix), calling `router.use(requireAuth)` inside one of them applies that middleware to the whole mount point, so it runs for sibling routers' routes too — public endpoints on the other root-mounted router start returning 401/403.

**Why:** Express middleware registered with `router.use(...)` on a router mounted at `/` matches every request that reaches that mount, before route matching narrows it down. Mounting order means the auth `use` of one router can intercept requests destined for another.

**How to apply:** Routers mounted at a non-empty prefix (e.g. `/chat`, `/journal`) can safely use `router.use(requireAuth)` because the prefix scopes them. Routers mounted at the bare root (e.g. a `/me` users router, a `/profile` router that shares root with a public `/notify` router) MUST attach `requireAuth` per-route (`router.get("/me", requireAuth, handler)`), never router-level. Mixed public/private routes in one router (e.g. safety: `/events` private, `/resources` public) also require per-route auth.
