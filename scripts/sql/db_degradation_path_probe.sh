#!/usr/bin/env bash
# Passive path probe: split login/CLI vs PostgREST vs Auth vs in-session SQL.
# One sequential pass. Not a load test. No DB mutation. Do not restart Postgres.
#
# Usage (from repo root, while a 10–30s episode is happening):
#   bash scripts/sql/db_degradation_path_probe.sh
#
# One CLI login-role attempt + HTTP split. Do not add extra CLI SQL or catalog watches.
#
# Correlate with session-mode catalog watch only after 5432 is in .env.local.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

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

URL="${EXPO_PUBLIC_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
ANON="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"

if [[ -z "$URL" || -z "$ANON" ]]; then
  echo "path_probe: missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY" >&2
  exit 1
fi

HOST="$(python3 -c 'from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).netloc)' "$URL")"

echo "checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "host=$HOST"
echo "probes=cli_select_1,auth_health,postgrest_openapi_head,postgrest_tiny_select"
echo "---"

echo "[1] supabase CLI select 1 (includes Initialising login role)"
set +e
/usr/bin/time -p npx supabase db query "select 1 as ok;" --linked -o json
cli_select_status=$?
set -e
echo "cli_select_1_exit=$cli_select_status"
echo "---"

curl_probe() {
  local name="$1"
  local method="$2"
  shift 2
  echo "[curl] $name"
  curl -sS -o /dev/null -X "$method" \
    -w "http_code=%{http_code} time_namelookup=%{time_namelookup} time_connect=%{time_connect} time_starttransfer=%{time_starttransfer} time_total=%{time_total} size=%{size_download}\n" \
    "$@"
}

echo "[2] Auth /auth/v1/health (gateway + GoTrue, no SQL)"
curl_probe auth_health GET \
  -H "apikey: ${ANON}" \
  "${URL}/auth/v1/health"
echo "---"

echo "[3] PostgREST OpenAPI GET /rest/v1/ (gateway + PostgREST; schema, not a table scan)"
curl_probe postgrest_openapi GET \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${ANON}" \
  "${URL}/rest/v1/"
echo "---"

echo "[4] PostgREST tiny select connection_requests?select=id&limit=1 (gateway + PostgREST + Postgres)"
curl_probe postgrest_tiny_select GET \
  -H "apikey: ${ANON}" \
  -H "Authorization: Bearer ${ANON}" \
  -H "Accept: application/json" \
  -H "Prefer: count=none" \
  "${URL}/rest/v1/connection_requests?select=id&limit=1"
echo "---"

echo "[5] skip extra CLI SQL — one login-role attempt is enough (do not hammer pooler)"
echo "episode_capture_skipped=1"
echo "next: catalog_watch.sh only after SUPABASE_DB_SESSION_URL :5432 is in .env.local"
echo "done"
