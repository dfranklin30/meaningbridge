---
name: Cross-page sessionStorage hand-off cleanup
description: A stashed payload handed between pages via sessionStorage + a query-param trigger must be cleared on every non-share entry/exit path, or it silently re-injects into a later unrelated flow.
---

When a page hands a payload to another page via `sessionStorage` plus a URL
trigger (e.g. journal stashes a letter -> `/companion?share=letter` -> the
companion auto-sends it as the first message), the receiving component holds that
payload in state.

**Rule:** clear both the sessionStorage key AND the in-component state on every
path that is NOT an active share — normal open, back/close, and after a
successful consume. Otherwise the stale payload can auto-inject into a later,
unrelated session (e.g. a private letter auto-sent into a fresh conversation the
user never intended).

**Why:** state that outlives its one intended use is a silent data-leak class of
bug — the auto-send effect fires whenever the stale state is still truthy.

**How to apply:** guard one-shot consumption behind a ref, remove the storage
key when consumed, and null the state in the plain (non-share) entry and the
close/back handlers — not only after the successful send.
