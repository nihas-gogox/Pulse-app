#!/usr/bin/env bash
# Read-only QA account/fixture check. Reads E2E_EMAIL from e2e/.env.e2e without printing it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ -f e2e/.env.e2e ] || { echo "ABORT: e2e/.env.e2e missing (copy e2e/.env.e2e.example and fill in a DEDICATED QA account)" >&2; exit 1; }
EMAIL="$(grep -E '^E2E_EMAIL=' e2e/.env.e2e | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
[ -n "$EMAIL" ] || { echo "ABORT: E2E_EMAIL empty in e2e/.env.e2e" >&2; exit 1; }
case "$EMAIL" in *"'"*) echo "ABORT: unexpected quote in E2E_EMAIL" >&2; exit 1;; esac
TMP="$(mktemp -t qa_check).sql"
trap 'rm -f "$TMP"' EXIT
sed "s/__QA_EMAIL__/${EMAIL//\//\\/}/" docs/compliance/dinesh/preprod/05_qa_account_check.sql > "$TMP"
bash docs/compliance/dinesh/preprod/run.sh "$TMP"
