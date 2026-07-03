---
name: Preview-mode state reset
description: Query-param preview modes that share a mounted component with the live form must reset seeded sample state on mode transition, or sample data leaks to real writes.
---

When a form supports a no-network "demo preview" via a query param (e.g. `?preview=1`) on the *same route/component* as the live form, toggling the param does NOT remount the component — the effect just re-runs. Any sample data seeded into state during preview persists into live mode.

**Why:** The live-load path often only overwrites form state when it finds an existing record. For a brand-new record (create flow, or a 404 "no profile yet" case) it leaves state untouched, so leftover preview sample data can be POSTed/submitted to a real endpoint.

**How to apply:** In the non-preview branch of the load effect, explicitly reset the seeded fields to live defaults for the create/empty case *before* any save/submit is reachable (reset form to empty, clear the record id, clear completion flags). Do not rely on the live fetch to clobber it. Keep the preview flag in the effect deps so the reset fires on the transition.
