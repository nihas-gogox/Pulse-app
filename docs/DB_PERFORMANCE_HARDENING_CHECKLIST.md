# DB Performance Hardening Checklist

This checklist is based on live `pg_stat_statements` and table stats from the linked Supabase project.

## Incident status (2026-09-19)

**ACTIVE / ROOT CAUSE UNRESOLVED**

### Forensic position (do not tighten this yet)

**Proven**

- Backend degradation occurred (reproduced 09:55 and 11:17 UTC).
- Auth and API edge can remain healthy while PostgreSQL-dependent paths degrade (CLI ~16s 544; PostgREST `limit=1` 503 ~28–34s TTFB).
- It can happen with only ~10–36 sessions when a snapshot is obtainable.
- It is not explained by max-connections exhaustion in sampled snapshots.
- Lock contention has not been observed in sampled episodes.

**Strong localization (not a proven root cause)**

- Failure boundary is **after** Auth/HTTP edge and **on** PostgreSQL-dependent paths (CLI login-role and PostgREST→PG).
- 11:17 UTC: CLI never established a session, so there is **no observation of PostgreSQL after connect**. PostgREST 503 could still be connection acquisition, backend availability, pooler, scheduling, or another layer between PostgREST and Postgres.

**Not proven**

- login-role / pooler auth as the initiating cause
- CPU, disk/I/O, WAL, checkpoint
- catalog/schema-cache as the initiating cause
- Case A vs B (needs session-mode 5432)
- Network / `get_trips_for_org` / `trip_documents` / Compliance as the 503 cause
- “Supabase infrastructure outage” as a named close

Application load cuts (Layer A) remain valid. They are not an incident close.

**No restart. No production DB mutation. No incident close. No claim that Network caused the outage.**

Two layers to keep separate:

- **Layer A — app-induced DB pressure:** Network full `get_trips_for_org`, duplicate detail/partner-display work, unbounded chunk concurrency, timeout retry amplification. Valid to reduce.
- **Layer B — 15–36s connection/setup degradation:** unresolved. Distinguishes login/pooler/host/Auth from in-session SQL.

During an Unhealthy window:

1. **At most one** `bash scripts/sql/db_degradation_path_probe.sh` (Auth / edge / one CLI login / one PostgREST `limit=1`). Do **not** add extra CLI SQL or catalog samples.
2. **Do not** run CLI catalog-watch (`supabase db query` loops) until `SUPABASE_DB_SESSION_URL` port **5432** is in `.env.local`. Then: `SAMPLES=4 SLEEP_S=3 bash scripts/sql/db_degradation_catalog_watch.sh` (refuses 6543 and CLI fallback).
3. Note Dashboard CPU, disk I/O, disk latency, connections at the same UTC time — capture only, do not interpret yet.

**Path probe 2026-09-19 11:17:33–11:25:32 UTC** (CLI catalog samples 1–3 = 544; sample 4 CLI retries hit ECIRCUITBREAKER / EAUTHQUERY — do not repeat that pattern):

| Probe | Result |
| --- | --- |
| CLI login + `select 1` | **544** ~16.4s |
| Auth health | **200** ~0.79s |
| PostgREST OpenAPI | **401** ~45ms |
| PostgREST `limit=1` | **503** ~34.1s TTFB |
| Episode SQL / catalog watch | no `pg_stat_activity` (session never established) |

**Path probe 2026-09-19 09:55–09:56 UTC** (same episode window; not an incident close):

| Probe | Result |
| --- | --- |
| CLI login + `select 1` | **fail 544** ~17s — `Failed to create login role: Connection terminated due to connection timeout` |
| Auth `GET /auth/v1/health` | **200** in **0.52s** (TCP connect ~28ms) |
| PostgREST `GET /rest/v1/` | **401** in **37ms** (rejected before catalog SQL) |
| PostgREST `connection_requests?select=id&limit=1` | **503** after **28.7s** TTFB (`time_starttransfer` ≈ `time_total`) |
| Episode SQL (retry) | succeeded ~31s wall; **10 sessions**, **1** active PostgREST catalog CTE (`base_types` recursive), **0** lock waits |

Auth/gateway were not globally dead. CLI role creation and PostgREST→Postgres were. One active backend was PostgREST schema introspection (wait_event null, xact ~15s). That is a **lead** (schema-cache / catalog SQL vs waiting for a PG connection), not a proven cause. CPU/disk still unmeasured.

## Incident rule (Dashboard “Unhealthy”)

Do **not** treat Dashboard Unhealthy as a mechanism, and do **not** restart production merely because the badge flipped.

An idle app does not mean an idle database (cron, Realtime, Auth, PostgREST, other clients, q-web, internal Supabase activity). Connection count in the ~20–35 range also does not prove the incident is “on compute / cron / restart.”

If Network (or any one surface) is idle and the instance remains degraded:

1. Keep app remediations local until they are validated as query-shape improvements, not as the incident close.
2. One four-path probe only. Catalog watch only with session-mode **5432**. No CLI catalog loops.
3. Record active query count, query/xact age, wait events, cache hit vs reads, WAL/checkpoint, autovacuum, cron, and blocking — then compare **app traffic vs degradation**.
4. Restart only if the service is materially unavailable and emergency recovery is required.

Network avoiding `get_trips_for_org` for card badges is a valid load cut. It is **not** by itself a proven solution to the DB incident.

## What we observed

- Connection count has been low during slow episodes (~20–36 sessions); that **does not** explain 10–30s admin login / cron timeouts by itself, and it does not identify CPU vs I/O vs WAL vs autovacuum vs cache pressure.
- Expensive read patterns (chat/trips, Network fan-out) are confirmed **contributors**, not a closed root cause.
- RLS-heavy tables (`trip_messages`, `trips`) are hot paths, so missing support indexes amplify CPU.

## Immediate actions (today)

- Run the SQL patch: `scripts/sql/db_perf_hardening_patch.sql`.
- Temporarily lower non-critical snapshot jobs frequency (for example `ops.capture_db_health_snapshot()` cadence) during incident windows.
- Keep driver location writes at 3-minute interval (already adjusted).

## App query/realtime actions (this repo)

- **Trip chat refresh storm protection**
  - `features/chat/contexts/TripChatContext.tsx` now uses debounced refresh for focused realtime inserts.
- **Avoid full-list reloads on every message event**
  - Prefer incremental state updates for unread counters and preview text.
  - Only hydrate missing conversations on demand, then batch refresh once.
- **Pagination guardrails**
  - Always bound thread/history reads (`limit`, cursor/range based pagination).
  - Do not fetch full nested message arrays for background badge updates.
- **Subscription hygiene**
  - Use one org-scoped subscription per screen mode.
  - Unsubscribe immediately on blur/unmount and avoid duplicate subscriptions across tabs.

## Post-deploy validation queries

Run these after shipping fixes and compare against baseline:

```sql
select count(*) filter (where state='active') as active_sessions,
       count(*) filter (where wait_event_type is not null) as waiting_sessions,
       count(*) as total_sessions
from pg_stat_activity
where datname=current_database();
```

```sql
select calls,
       round(total_exec_time::numeric,2) as total_ms,
       round(mean_exec_time::numeric,2) as mean_ms,
       left(query,160) as query_sample
from pg_stat_statements
where dbid = (select oid from pg_database where datname=current_database())
order by total_exec_time desc
limit 20;
```

```sql
select schemaname,
       relname as table_name,
       seq_scan,
       idx_scan,
       n_live_tup,
       n_dead_tup
from pg_stat_user_tables
order by n_dead_tup desc
limit 20;
```

## Success criteria

- p95 read/query latency down during peak windows.
- Fewer CPU spike bursts in Grafana during chat-heavy usage.
- No unhealthy flips during routine traffic.
- `pg_stat_statements` top total time shifts away from trip/chat list fetches.
