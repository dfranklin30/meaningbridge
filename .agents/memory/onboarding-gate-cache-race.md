---
name: Onboarding gate cache race
description: Why onboarding completion must seed the profile query cache before navigating, or new users get bounced back to step one.
---

# Onboarding gate cache race

The seeker onboarding gate lives in the shared `Layout`: a `useEffect` redirects to
`/onboarding` whenever `profile.onboardingComplete === false` and the route is gated.
The `/onboarding` page keeps its wizard `step` in local component state (starts at
`"name"`).

**Rule:** when a mutation flips `onboardingComplete` (or any field the gate reads)
and then navigates into the gated app, write the server's returned profile into the
TanStack Query cache **synchronously** with `queryClient.setQueryData(getGetProfileQueryKey(), updated)`
*before* `setLocation(...)`. Do not rely on `invalidateQueries` alone.

**Why:** `invalidateQueries` only marks the query stale and refetches asynchronously —
the cached value stays `false` until the refetch resolves. If you navigate to `/app`
in that window, `Layout` reads the stale `onboardingComplete=false`, redirects back to
`/onboarding`, which remounts and resets the wizard to step one. Symptom reported by
users: "it goes back to the beginning / asks me to enter again." The generated Orval
mutation hooks do NOT auto-update the query cache, so the stale window is real.

**How to apply:** any completion/finish handler that both mutates profile state the gate
depends on and then routes into a gated area must `setQueryData` with the mutation's
return value first. Same pattern applies to any future gate keyed on a cached query.
