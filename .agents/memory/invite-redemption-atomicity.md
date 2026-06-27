---
name: Invite / claim redemption must be atomic
description: One-time-code redemption (invites, claims, ownership transfer) must use a conditional UPDATE, not select-then-update-by-id.
---

# Invite / claim redemption must be atomic

When redeeming a single-use code that transfers or sets ownership (care invite
codes, object-entity claims, etc.), do NOT read the row, validate it in JS, then
`UPDATE ... WHERE id = ?`. Two concurrent requests can both pass the JS pre-check
and the second write silently overwrites the first claimant's ownership/consent.

**Rule:** put the guard conditions in the UPDATE's WHERE clause so the database
enforces single-use atomically, then treat "no row returned" as already-claimed:

```ts
const [updated] = await db.update(t)
  .set({ clientUserId: me, status: "active", ... })
  .where(and(eq(t.id, invite.id), eq(t.status, "pending"), isNull(t.clientUserId)))
  .returning();
if (!updated) { res.status(409).json({ error: "already used" }); return; }
```

**Why:** a TOCTOU race in the care-relationship invite flow let a later
redemption overwrite an existing connection's owner + consent flags. Found in
code review of the clinician<>client Phase 1 foundation.

**How to apply:** any "claim this code/resource once" flow. Also restrict
follow-up mutations (e.g. consent toggles) to `status = 'active'` rows so revoked
relationships are immutable.
