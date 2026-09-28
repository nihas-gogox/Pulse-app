-- PostgREST /ready is red because schema-cache reloads die at authenticator's
-- 20s statement_timeout (57014). That reconnect loop also starves Storage.
-- Give cache loads enough time to finish; pause Reach crons that cannot start.
-- Do not raise max_connections.

ALTER ROLE authenticator SET statement_timeout = '120s';

DO $$
DECLARE
  jid bigint;
  r record;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'reach_campaigns_pace';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, active := false);
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'reach_campaigns_expire';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, active := false);
  END IF;

  FOR r IN
    SELECT pid
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND state = 'active'
      AND usename IN ('authenticated', 'anon', 'authenticator')
      AND query_start < now() - interval '25 seconds'
      AND query NOT ILIKE '%pg_cancel_backend%'
      AND query NOT ILIKE '%schema cache%'
      AND query NOT ILIKE '%pg_catalog%'
  LOOP
    BEGIN
      PERFORM pg_cancel_backend(r.pid);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
