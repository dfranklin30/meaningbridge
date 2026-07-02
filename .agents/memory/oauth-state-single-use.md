---
name: OAuth state must be consumed atomically
description: Single-use OAuth/PKCE state rows must be deleted-and-returned in one statement, not select-then-delete.
---

# OAuth state single-use consumption

A `select` to find the state row followed by a separate `delete` is NOT single-use:
two near-simultaneous callbacks with the same `state` can both read before either
deletes, and both proceed to token exchange.

**Rule:** consume state with one atomic statement —
`db.delete(table).where(state=? AND providerUserId=?).returning()` — and proceed
only when exactly one row comes back. Also enforce a TTL on `createdAt` (e.g. 10 min)
to bound the replay window for abandoned states.

**Why:** true single-use / anti-replay semantics for CSRF-binding OAuth state.
**How to apply:** any single-use token/nonce/state table (OAuth, magic links,
password-reset tokens) — never select-then-mutate; delete-and-return atomically.
