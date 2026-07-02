---
name: drizzle-kit push interactive rename prompt
description: How to apply column renames when drizzle-kit push blocks on a TTY prompt that ignores piped stdin
---

# drizzle-kit push blocks on rename prompts

`pnpm --filter @workspace/db run push` (drizzle-kit push) asks
"Is <col> created or renamed from another column?" whenever a column name
changes. This prompt is a **TTY selector** — piping input (`printf '\n' | ...`)
does NOT answer it; the command just hangs.

**How to apply:** when a schema change renames a column (or otherwise triggers
the create-vs-rename prompt), apply the change directly with `psql "$DATABASE_URL"`
(RENAME COLUMN, DROP/CREATE INDEX, etc.), then run push again — it will report
`No changes detected`. This is safe for empty/new tables. For tables with data,
prefer the explicit `psql` ALTER so you control whether data is preserved rather
than letting push guess.
