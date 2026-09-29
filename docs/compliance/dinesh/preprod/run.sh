#!/usr/bin/env bash
# Run one SQL file against the linked Supabase project — PREPROD ONLY.
# Usage: bash docs/compliance/dinesh/preprod/run.sh <file.sql>
# Aborts unless supabase/.temp/project-ref is the preprod ref.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

EXPECTED_REF="xbisiveavvbifbzyfhgy" # "pre-prod" (docs/GIT_WORKFLOW.md). Prod is nafxpivddesgsrthmosv.
REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [ "$REF" != "$EXPECTED_REF" ]; then
  echo "ABORT: linked project is '${REF:-<none>}', expected ${EXPECTED_REF} (preprod)." >&2
  exit 1
fi

SQL="${1:?usage: run.sh <file.sql>}"
[ -f "$SQL" ] || { echo "ABORT: $SQL not found" >&2; exit 1; }
echo "target: ${REF} (preprod) · file: ${SQL}"
supabase db query -f "$SQL" --linked -o table
