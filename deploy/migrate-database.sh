#!/usr/bin/env bash
# ============================================================
# Copies ALL data from the old Replit database to the new Neon
# database. Run in Google Cloud Shell from the project root:
#   bash deploy/migrate-database.sh
# It will ask for both connection strings.
# Safe to re-run (it fully replaces the Neon side each time).
# ============================================================
set -euo pipefail

echo "Paste the OLD Replit DATABASE_URL (from Replit -> Secrets), then press Enter:"
read -r OLD_URL
echo "Paste the NEW Neon connection string, then press Enter:"
read -r NEW_URL

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP="replit-backup-$STAMP.dump"

echo "==> Backing up the Replit database to $DUMP ..."
pg_dump --no-owner --no-privileges --format=custom --file="$DUMP" "$OLD_URL"
echo "    Backup complete: $(du -h "$DUMP" | cut -f1)"

echo "==> Restoring into Neon ..."
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname="$NEW_URL" "$DUMP" || true

echo "==> Verifying row counts in Neon ..."
psql "$NEW_URL" -c "
  SELECT relname AS table, n_live_tup AS rows
  FROM pg_stat_user_tables
  WHERE schemaname='public'
  ORDER BY relname;"

echo ""
echo "Done. Keep $DUMP somewhere safe — it is a full backup of your site data."
