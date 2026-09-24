-- Run in Dashboard SQL Editor as postgres while Database is Unhealthy.
-- Releases idle-in-transaction slots and pauses diagnostic crons.
-- Do not raise max_connections.

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle in transaction'
  AND xact_start < now() - interval '20 seconds';

DO $$
DECLARE
  r record;
BEGIN
  -- postgres cannot UPDATE cron.job on hosted Supabase; use alter_job.
  FOR r IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'cron-health-alert',
      'monitor-watchdog',
      'ops_capture_slow_queries',
      'log-watcher-main',
      'log-watcher-health',
      'detect-cron-startup-timeout-incident'
    )
    OR command ILIKE '%dispatch_log_watcher%'
    OR command ILIKE '%detect_cron_incident%'
    OR command ILIKE '%run_db_health_monitor%'
    OR command ILIKE '%run_monitor_watchdog%'
    OR command ILIKE '%capture_db_health_snapshot%'
    OR command ILIKE '%ops_capture_slow_queries%'
  LOOP
    PERFORM cron.alter_job(job_id := r.jobid, active := false);
  END LOOP;
END $$;

SELECT
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) AS total
FROM pg_stat_activity
WHERE datname = current_database();
