#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Export it and run this script. Example:" >&2
  echo "export SUPABASE_DB_URL=\"postgres://user:pass@host:5432/postgres\"" >&2
  exit 1
fi

echo "Applying migrations from supabase/migrations using SUPABASE_DB_URL"
for f in supabase/migrations/*.sql; do
  echo "-- Applying $f"
  psql "$SUPABASE_DB_URL" -f "$f"
done

echo "Migrations applied."
