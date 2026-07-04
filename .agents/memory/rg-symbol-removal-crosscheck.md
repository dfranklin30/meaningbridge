---
name: rg vs grep for symbol-removal sweeps
description: In this repo, ripgrep has silently missed matches in tracked source when sweeping for a removed symbol; cross-check with grep.
---

When fully removing a named symbol/feature (e.g. an inventory like IDWL), do NOT trust a single `rg` "no matches" as proof the sweep is clean.

**What happened:** During the IDWL removal, `rg -rli "idwl"` and `rg -rin "idwl"` both returned NO matches, yet `grep -rin "idwl"` found live remnants in tracked source (`artifacts/meaningbridge/src/lib/clinical.ts` constants, `artifacts/meaningbridge/src/pages/demo.tsx` marketing copy) plus stale compiled `.d.ts` in `lib/*/dist`. The code review (architect) caught the remnants after rg reported clean.

**Why:** rg silently under-reported here (tracked files, not just gitignored `dist`). Cause is environment-specific and not fully diagnosed, but the failure mode is real.

**How to apply:**
- For removal sweeps, run BOTH `rg` and `grep -rin` and reconcile. If they disagree, trust grep and investigate.
- Sweep for the concept, not just the acronym (e.g. also "Daily Widowed", "dual-process", subscale labels), since prose/marketing copy references survive symbol deletion.
- After removing generated types, delete and rebuild `lib/*/dist` (`tsc --build` does not prune stale outputs) so old `.d.ts` don't linger.
- Run a code review (architect) after "full removal" tasks — it independently re-scans and catches what a bad sweep missed.
