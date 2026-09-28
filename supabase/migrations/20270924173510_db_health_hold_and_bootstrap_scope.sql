-- Keep the pool healthy without raising max_connections.
-- 1) Cheap degraded predicate + skip diagnostic work when ≥80% connections.
-- 2) Stop party-page bootstrap from scanning every indent trip on a linked org.

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

CREATE OR REPLACE FUNCTION public.dispatch_log_watcher_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key CONSTANT bigint := hashtextextended('dispatch_log_watcher_scheduler', 0);
  v_got_lock boolean;
  v_url text;
  v_key text;
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;

  v_got_lock := pg_try_advisory_lock(v_lock_key);
  IF NOT v_got_lock THEN
    RETURN;
  END IF;

  BEGIN
    v_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
    IF v_url IS NULL THEN
      PERFORM pg_advisory_unlock(v_lock_key);
      RETURN;
    END IF;

    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key';

    IF v_key IS NULL OR btrim(v_key) = '' THEN
      PERFORM pg_advisory_unlock(v_lock_key);
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := v_url || '/functions/v1/log-watcher-scheduler',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(v_lock_key);
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_log_watcher_scheduler() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.run_ops_capture_slow_queries_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ops
AS $$
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '10s';
  PERFORM ops.capture_slow_queries(500);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_ops_capture_health_snapshot_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ops
AS $$
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  SET LOCAL statement_timeout = '10s';
  PERFORM ops.capture_db_health_snapshot();
END;
$$;

CREATE OR REPLACE FUNCTION public.detect_cron_incident_if_healthy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.db_pool_is_degraded() THEN
    RETURN;
  END IF;
  PERFORM public.detect_cron_incident_guarded();
END;
$$;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'ops_capture_slow_queries';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, command := 'SELECT public.run_ops_capture_slow_queries_guarded();');
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'log-watcher-health';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, command := 'SELECT public.run_ops_capture_health_snapshot_guarded();');
  END IF;
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'detect-cron-startup-timeout-incident';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := jid, command := 'SELECT public.detect_cron_incident_if_healthy();');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_client_page_bootstrap(
  p_org_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client jsonb;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(c)
  INTO v_client
  FROM public.clients c
  WHERE c.id = p_client_id
    AND c.organization_id = p_org_id
  LIMIT 1;

  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH tx_trip_ids AS (
      SELECT DISTINCT t.trip_id AS id
      FROM public.transactions t
      WHERE t.organization_id = p_org_id
        AND t.contact_type = 'client'
        AND t.contact_id = p_client_id
        AND t.trip_id IS NOT NULL
    ),
    scoped_ids AS (
      SELECT tr.id
      FROM public.trips tr
      WHERE tr.deleted_at IS NULL
        AND tr.organization_id = p_org_id
        AND tr.client_id = p_client_id
      UNION
      SELECT id FROM tx_trip_ids
    ),
    scoped_trips AS (
      SELECT
        CASE WHEN tr.organization_id = p_org_id THEN tr.client_price END AS client_price,
        CASE WHEN tr.organization_id = p_org_id THEN tr.margin END AS margin,
        CASE WHEN tr.organization_id = p_org_id THEN tr.platform_fee END AS platform_fee,
        CASE WHEN tr.organization_id = p_org_id THEN tr.driver_commission END AS driver_commission,
        CASE WHEN tr.organization_id = p_org_id THEN tr.amount_paid END AS amount_paid,
        CASE WHEN tr.organization_id = p_org_id THEN tr.payment_status END AS payment_status,
        CASE WHEN tr.organization_id = p_org_id THEN tr.client_id ELSE NULL END AS client_id,
        tr.id,
        tr.organization_id,
        tr.trip_number,
        tr.source,
        tr.display_trip_id,
        tr.driver_display_trip_id,
        tr.trip_code,
        tr.trip_operational_code,
        tr.booking_ref,
        tr.sequence_number,
        tr.pickup_area,
        tr.drop_location,
        tr.distance,
        tr.estimated_duration,
        tr.pickup_lat,
        tr.pickup_lon,
        tr.drop_lat,
        tr.drop_lon,
        tr.load_type,
        tr.load_tons,
        tr.notes,
        tr.client_name,
        tr.supplier_id,
        tr.supplier_trip_sequence,
        tr.supplier_rate,
        tr.advance_paid,
        tr.is_guaranteed,
        tr.trip_payout_mode,
        tr.operating_mode,
        tr.dco_payee_id,
        tr.driver_id,
        tr.vehicle_id,
        tr.owner_vehicle_id,
        tr.driver_display_name,
        tr.vehicle_display_number,
        tr.status,
        tr.pickup_date,
        tr.started_at,
        tr.completed_at,
        tr.created_at,
        tr.updated_at,
        tr.deleted_at,
        tr.pod_received_at,
        tr.pod_required,
        tr.indent_id,
        tr.source_indent_id,
        i.indent_number
      FROM public.trips tr
      LEFT JOIN public.indents i ON i.id = tr.indent_id
      WHERE tr.id IN (SELECT id FROM scoped_ids LIMIT 400)
    )
    SELECT jsonb_build_object(
      'client', v_client,
      'ratings', (
        SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM public.ratings r
        WHERE r.rated_type = 'client'
          AND r.rated_id = p_client_id
      ),
      'warehouses', (
        SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
        FROM public.client_warehouses w
        WHERE w.organization_id = p_org_id
          AND w.client_id = p_client_id
      ),
      'contracts', (
        SELECT COALESCE(jsonb_agg(to_jsonb(cc) ORDER BY cc.created_at ASC), '[]'::jsonb)
        FROM public.client_contracts cc
        WHERE cc.organization_id = p_org_id
          AND cc.client_id = p_client_id
          AND (cc.valid_to IS NULL OR cc.valid_to >= CURRENT_DATE)
      ),
      'trips', (
        SELECT COALESCE(jsonb_agg(to_jsonb(st) ORDER BY st.created_at DESC), '[]'::jsonb)
        FROM scoped_trips st
      ),
      'transactions', (
        SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.transaction_date DESC, x.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT
            t.id,
            t.organization_id,
            t.trip_id,
            t.party_name,
            t.description,
            t.amount_in,
            t.amount_out,
            t.transaction_date,
            t.created_at,
            t.contact_id,
            t.contact_type,
            t.ledger_entity_type,
            t.ledger_flow_type,
            t.ledger_category,
            t.payment_ref,
            t.created_by,
            t.booking_ref,
            t.is_opening_balance
          FROM public.transactions t
          WHERE t.organization_id = p_org_id
            AND t.contact_id = p_client_id
            AND t.contact_type = 'client'
          ORDER BY t.transaction_date DESC, t.created_at DESC
          LIMIT 500
        ) x
      ),
      'suppliers', (
        SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
        FROM public.suppliers s
        WHERE s.organization_id = p_org_id
          AND s.id IN (SELECT supplier_id FROM scoped_trips WHERE supplier_id IS NOT NULL)
      ),
      'drivers', (
        SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
        FROM public.drivers d
        WHERE d.organization_id = p_org_id
          AND d.id IN (SELECT driver_id FROM scoped_trips WHERE driver_id IS NOT NULL)
      ),
      'clients', jsonb_build_array(v_client)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_client_page_bootstrap(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_page_bootstrap(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_supplier_page_bootstrap(
  p_org_id uuid,
  p_supplier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier jsonb;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(s)
  INTO v_supplier
  FROM public.suppliers s
  WHERE s.id = p_supplier_id
    AND s.organization_id = p_org_id
  LIMIT 1;

  IF v_supplier IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH scoped_ids AS (
      SELECT tr.id
      FROM public.trips tr
      WHERE tr.deleted_at IS NULL
        AND tr.organization_id = p_org_id
        AND tr.supplier_id = p_supplier_id
      UNION
      SELECT ts.trip_id
      FROM public.trip_subcontracts ts
      WHERE ts.viewer_org_id = p_org_id
        AND ts.supplier_id = p_supplier_id
    ),
    scoped_trips AS (
      SELECT DISTINCT ON (tr.id)
        CASE WHEN tr.organization_id = p_org_id THEN tr.client_price END AS client_price,
        CASE WHEN tr.organization_id = p_org_id THEN tr.margin END AS margin,
        CASE WHEN ts.rate IS NOT NULL THEN ts.rate ELSE tr.supplier_rate END AS supplier_rate,
        CASE
          WHEN ts.rate IS NOT NULL THEN COALESCE(tr.supplier_rate, tr.client_price)
          ELSE NULL
        END AS aggregate_sales,
        tr.id,
        tr.organization_id,
        tr.trip_number,
        tr.source,
        tr.display_trip_id,
        tr.driver_display_trip_id,
        tr.trip_code,
        tr.trip_operational_code,
        tr.booking_ref,
        tr.pickup_area,
        tr.drop_location,
        tr.distance,
        tr.client_id,
        tr.client_name,
        tr.supplier_id,
        tr.advance_paid,
        tr.driver_id,
        tr.vehicle_id,
        tr.driver_display_name,
        tr.vehicle_display_number,
        tr.status,
        tr.pickup_date,
        tr.started_at,
        tr.completed_at,
        tr.created_at,
        tr.updated_at,
        tr.indent_id,
        tr.source_indent_id,
        i.indent_number
      FROM public.trips tr
      LEFT JOIN public.indents i ON i.id = tr.indent_id
      LEFT JOIN public.trip_subcontracts ts
        ON ts.trip_id = tr.id
       AND ts.viewer_org_id = p_org_id
       AND ts.supplier_id = p_supplier_id
      WHERE tr.id IN (SELECT id FROM scoped_ids LIMIT 400)
      ORDER BY tr.id, tr.created_at DESC
    )
    SELECT jsonb_build_object(
      'supplier', v_supplier,
      'trips', (
        SELECT COALESCE(jsonb_agg(to_jsonb(st) ORDER BY st.created_at DESC), '[]'::jsonb)
        FROM scoped_trips st
      ),
      'transactions', (
        SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.transaction_date DESC, x.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT
            t.id,
            t.organization_id,
            t.trip_id,
            t.party_name,
            t.description,
            t.amount_in,
            t.amount_out,
            t.transaction_date,
            t.created_at,
            t.contact_id,
            t.contact_type,
            t.ledger_entity_type,
            t.ledger_flow_type,
            t.ledger_category,
            t.payment_ref,
            t.created_by,
            t.booking_ref,
            t.is_opening_balance
          FROM public.transactions t
          WHERE t.organization_id = p_org_id
            AND t.contact_id = p_supplier_id
            AND t.contact_type = 'supplier'
          ORDER BY t.transaction_date DESC, t.created_at DESC
          LIMIT 500
        ) x
      ),
      'suppliers', jsonb_build_array(v_supplier),
      'drivers', (
        SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
        FROM public.drivers d
        WHERE d.organization_id = p_org_id
          AND d.id IN (SELECT driver_id FROM scoped_trips WHERE driver_id IS NOT NULL)
      ),
      'clients', (
        SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
        FROM public.clients c
        WHERE c.organization_id = p_org_id
          AND c.id IN (SELECT client_id FROM scoped_trips WHERE client_id IS NOT NULL)
      )
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_supplier_page_bootstrap(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_page_bootstrap(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
