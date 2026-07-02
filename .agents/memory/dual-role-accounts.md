---
name: Dual-role accounts (seeker + professional)
description: One account can hold both the grief-seeker and clinician capabilities at once; how capabilities, activeSpace, and the legacy role column relate.
---

# Dual-role accounts

An account can be BOTH a seeker and a professional. Capabilities are stored as two
additive booleans on `users` (`isSeeker`, `isProfessional`) plus `activeSpace`
(`seeker` | `professional` | null) for which space is currently open. The legacy
`role` column is kept mirrored to `activeSpace` for older reads.

**Rules:**
- `/me` PATCH is additive: `roles[]` sets the full capability set; the legacy
  `role` shortcut GRANTS one capability without revoking the other. Switching
  spaces never removes a capability.
- `activeSpace` is normalized server-side so it can never point at a capability
  the account does not hold.
- Routing and gating (App.tsx, `requireProfessional`) key off the **capabilities**,
  not `role`. Gating on `role` alone is the old single-role trap and causes
  redirect loops for dual accounts — a dual user must be able to stay in `/app`.

**Why:** the product needs clinicians who are also grieving (and vice versa) to
use one login and switch via the top-corner PortalSwitcher, without losing access
to either side.

**How to apply:** when adding a space-gated route or feature, check the relevant
capability boolean; use `activeSpace` only to decide the default landing/switcher
highlight, never as the access check.
