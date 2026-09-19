#!/usr/bin/env python3
"""One session-mode connection: time connect, in-session select 1, then catalog watch.

Distinguishes new-connection slowness from in-session SQL, and same-PID catalog
work from new PostgREST backends. Read-only. No DDL.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: db_degradation_catalog_watch.py POSTGRES_URL [samples] [sleep_s] [sql_path]", file=sys.stderr)
        return 2
    url = sys.argv[1]
    samples = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    sleep_s = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
    if samples > 4:
        samples = 4
    sql_path = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(__file__).with_name(
        "db_degradation_catalog_watch.sql"
    )
    try:
        import psycopg2
    except ImportError:
        print("psycopg2_missing=1", file=sys.stderr)
        return 2

    sql = sql_path.read_text()
    t0 = time.perf_counter()
    conn = psycopg2.connect(url, connect_timeout=40)
    conn.autocommit = True
    print(f"psql_connect_s={time.perf_counter() - t0:.3f}")
    cur = conn.cursor()
    print(f"observer_backend_pid={conn.get_backend_pid()}")
    for i in range(5):
        t1 = time.perf_counter()
        cur.execute("select 1")
        cur.fetchone()
        print(f"in_session_select_1_{i + 1}_s={time.perf_counter() - t1:.4f}")

    pids_seen: list[int] = []
    for i in range(samples):
        wall = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        t1 = time.perf_counter()
        cur.execute(sql)
        row = cur.fetchone()
        print(f"sample={i + 1} wall={wall} watch_query_s={time.perf_counter() - t1:.3f}")
        payload = row[0] if row else "{}"
        print(payload)
        try:
            data = json.loads(payload) if isinstance(payload, str) else payload
            rows = data.get("catalog_or_postgrest") or []
            sample_pids = [int(r["pid"]) for r in rows if r.get("pid") is not None]
            pids_seen.extend(sample_pids)
            print(f"sample_pids={sample_pids}")
        except (TypeError, ValueError, KeyError):
            pass
        if i + 1 < samples:
            time.sleep(sleep_s)

    unique = sorted(set(pids_seen))
    print(f"pids_across_samples={unique}")
    print(f"pid_unique_count={len(unique)}")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
