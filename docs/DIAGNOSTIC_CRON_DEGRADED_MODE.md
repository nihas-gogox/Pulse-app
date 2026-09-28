# Diagnostic cron degraded mode

The six diagnostic jobs (2, 6, 11, 15, 17, 18) must not amplify a DB outage.

## During a pool/WAL incident

Operator action (Dashboard SQL as `postgres`):

1. Read-only preview (`pg_stat_activity` idle-in-tx + `cron.job`).
2. Run `scripts/sql/emergency_release_pool_unhealthy.sql` **once** if the preview is clean.

That pauses only:

- cron-health-alert
- monitor-watchdog
- ops_capture_slow_queries
- log-watcher-main
- log-watcher-health
- detect-cron-startup-timeout-incident

Jobs 4, 7, 8, 9, 10, 16, 19 stay on.

## When those jobs are re-enabled

`public.db_pool_is_degraded()` is a cheap `pg_stat_activity` count against
`max_connections`. Guarded wrappers return immediately when it is true:

- no large snapshots
- no nested health RPCs
- no log-watcher fan-out
- no incident-detector diagnosing another diagnostic failure

`run_db_health_monitor` already skips its heaviest scans at ≥80% connections
(`20261120000003_health_monitor_connection_short_circuit.sql`).

Do not add more diagnostic jobs that write snapshots or call `net.http_post`
without this skip.
