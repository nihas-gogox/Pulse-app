-- Cheap degraded-mode predicate for diagnostic crons (jobs 2/6/11/15/17/18).
-- Does not change max_connections or timeouts. Does not disable Reach/prune/ANALYZE.
-- Phase C only — do not db push until production recovery is verified.
--
-- Incident control remains the operator pause in
-- scripts/sql/emergency_release_pool_unhealthy.sql.
-- After those jobs are re-enabled, guarded wrappers should call this first.
-- run_db_health_monitor already skips its heaviest scans at ≥80% connections.

CREATE OR REPLACE FUNCTION public.db_pool_is_degraded()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT count(*) >= greatest(
    1,
    ((SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') * 4) / 5
  )
  FROM pg_stat_activity
  WHERE datname = current_database();
$$;

REVOKE ALL ON FUNCTION public.db_pool_is_degraded() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_pool_is_degraded() TO postgres;

CREATE OR REPLACE FUNCTION public.run_db_health_monitor_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key CONSTANT bigint := hashtextextended('run_db_health_monitor', 0);
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '15s';
  PERFORM public.run_db_health_monitor();
END;
$$;

CREATE OR REPLACE FUNCTION public.run_monitor_watchdog_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key CONSTANT bigint := hashtextextended('run_monitor_watchdog', 0);
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '10s';
  PERFORM public.run_monitor_watchdog();
END;
$$;
