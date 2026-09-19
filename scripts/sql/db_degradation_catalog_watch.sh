#!/usr/bin/env bash
# Catalog / in-session watch — SESSION-MODE 5432 ONLY.
#
# Do NOT fall back to repeated `supabase db query --linked` during Unhealthy.
# CLI catalog sampling hammers login-role creation, retries, and can trip
# pooler circuit breakers (see 2026-09-19 11:17Z sample 4).
#
# Requires SUPABASE_DB_SESSION_URL (or DATABASE_URL) on port 5432 in .env.local.
# Transaction-mode :6543 is rejected.
#
# Usage (next Unhealthy window, after 5432 is configured):
#   SAMPLES=4 SLEEP_S=3 bash scripts/sql/db_degradation_catalog_watch.sh
#
# Not a load test. No DDL. Do not restart Postgres.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SAMPLES="${SAMPLES:-4}"
SLEEP_S="${SLEEP_S:-3}"
if [[ "$SAMPLES" -gt 4 ]]; then
  echo "catalog_watch: capping SAMPLES at 4 (requested $SAMPLES)" >&2
  SAMPLES=4
fi

load_env() {
  local f
  for f in .env.local .env; do
    if [[ -f "$f" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$f"
      set +a
    fi
  done
}

load_env

PSQL_URL="${SUPABASE_DB_SESSION_URL:-${DATABASE_URL:-}}"
echo "checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "samples=$SAMPLES sleep_s=$SLEEP_S"

if [[ -z "$PSQL_URL" ]]; then
  echo "catalog_watch: refused — no SUPABASE_DB_SESSION_URL / DATABASE_URL (need session-mode 5432)." >&2
  echo "Do not use CLI catalog samples during Unhealthy. Four-path probe only until 5432 is set." >&2
  exit 2
fi

if [[ "$PSQL_URL" == *":6543"* ]]; then
  echo "catalog_watch: refused — URL is transaction-mode (:6543). Use session pooler port 5432." >&2
  exit 2
fi

if [[ "$PSQL_URL" != *":5432"* ]]; then
  echo "catalog_watch: refused — URL must include port 5432 (session mode)." >&2
  exit 2
fi

echo "[A+B] session-mode 5432: connect timing, in-session select 1, then catalog watch"
set +e
python3 "$ROOT/scripts/sql/db_degradation_catalog_watch.py" \
  "$PSQL_URL" "$SAMPLES" "$SLEEP_S" \
  "$ROOT/scripts/sql/db_degradation_catalog_watch.sql"
py_status=$?
set -e

if [[ "$py_status" -eq 2 ]]; then
  echo "catalog_watch: refused — psycopg2 missing. pip install psycopg2-binary (do not fall back to CLI)." >&2
  exit 2
fi

echo "session_watch_exit=$py_status"
echo "interpret:"
echo "  A: connect_s high + in_session_select_1_* low → connection/setup/pooler/backend creation"
echo "  B: in_session_select_1 also slow + same PID catalog slow → PG execution/resource/catalog"
echo "  C: pid churn, few sessions → backend lifecycle"
echo "  D: same pid 20-30s+ stable wait → that operation/resource"
echo "done"
exit "$py_status"
