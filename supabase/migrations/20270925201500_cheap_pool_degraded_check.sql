-- Keep the pool healthy without raising max_connections.
-- Counting pg_stat_activity during an IO storm can itself hang (the degraded
-- guard then piles on). Use pg_stat_database.numbackends instead.
-- Also skip Reach expire/pace when the pool is already ≥80% so cron workers
-- do not sit in "job startup timeout" and hold slots.

CREATE OR REPLACE FUNCTION public.db_pool_is_degraded()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (
      SELECT s.numbackends
      FROM pg_stat_database s
      WHERE s.datname = current_database()
    ),
    0
  ) >= greatest(
    1,
    ((SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') * 4) / 5
  );
$$;

REVOKE ALL ON FUNCTION public.db_pool_is_degraded() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_pool_is_degraded() TO postgres;

CREATE OR REPLACE FUNCTION public.fn_expire_reach_campaigns_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '8s';
  PERFORM public.fn_expire_reach_campaigns();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_pace_reach_campaigns_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '8s';
  PERFORM public.fn_pace_reach_campaigns();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_expire_reach_campaigns_guarded() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_pace_reach_campaigns_guarded() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_expire_reach_campaigns_guarded() TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_pace_reach_campaigns_guarded() TO postgres;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'reach_campaigns_expire';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, command := 'SELECT public.fn_expire_reach_campaigns_guarded();');
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'reach_campaigns_pace';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, command := 'SELECT public.fn_pace_reach_campaigns_guarded();');
  END IF;
END $$;

-- Fail fast on app-wide hydration so a 17s bootstrap cannot pin a pool slot.
DO $$
BEGIN
  ALTER FUNCTION public.get_global_app_bootstrap(uuid) SET statement_timeout = '8s';
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;
