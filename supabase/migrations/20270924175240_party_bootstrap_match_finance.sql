-- Align party-page bootstrap trips with Finance tab attribution.
-- Same membership as aggregateCustomers / aggregateSuppliers / selectedEntityTrips:
-- own-org id/name, ledger trip ids, unique linked-org load trips (capped).

CREATE OR REPLACE FUNCTION public.client_page_trip_ids(
  p_org_id uuid,
  p_client_id uuid
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH c AS (
    SELECT
      cl.id,
      cl.linked_organization_id,
      lower(btrim(COALESCE(cl.name, cl.contact_person, ''))) AS name_key
    FROM public.clients cl
    WHERE cl.id = p_client_id
      AND cl.organization_id = p_org_id
  )
  SELECT tr.id
  FROM public.trips tr
  JOIN c ON true
  WHERE tr.deleted_at IS NULL
    AND tr.organization_id = p_org_id
    AND tr.client_id = p_client_id
  UNION
  SELECT tr.id
  FROM public.trips tr
  JOIN c ON c.name_key <> ''
  WHERE tr.deleted_at IS NULL
    AND tr.organization_id = p_org_id
    AND lower(btrim(COALESCE(tr.client_name, ''))) = c.name_key
  UNION
  SELECT t.trip_id
  FROM public.transactions t
  WHERE t.organization_id = p_org_id
    AND t.contact_type = 'client'
    AND t.contact_id = p_client_id
    AND t.trip_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.client_page_trip_ids(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_page_trip_ids(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.supplier_page_trip_ids(
  p_org_id uuid,
  p_supplier_id uuid
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (
    SELECT
      su.id,
      su.linked_organization_id,
      lower(btrim(COALESCE(su.name, su.company_name, su.contact_person, ''))) AS name_key
    FROM public.suppliers su
    WHERE su.id = p_supplier_id
      AND su.organization_id = p_org_id
  ),
  unique_link AS (
    SELECT s.linked_organization_id AS linked
    FROM s
    WHERE s.linked_organization_id IS NOT NULL
      AND (
        SELECT count(*)
        FROM public.suppliers x
        WHERE x.organization_id = p_org_id
          AND x.linked_organization_id = s.linked_organization_id
      ) = 1
  )
  SELECT tr.id
  FROM public.trips tr
  JOIN s ON true
  WHERE tr.deleted_at IS NULL
    AND tr.organization_id = p_org_id
    AND tr.supplier_id = p_supplier_id
  UNION
  SELECT ts.trip_id
  FROM public.trip_subcontracts ts
  WHERE ts.viewer_org_id = p_org_id
    AND ts.supplier_id = p_supplier_id
  UNION
  SELECT t.trip_id
  FROM public.transactions t
  WHERE t.organization_id = p_org_id
    AND t.contact_type = 'supplier'
    AND t.contact_id = p_supplier_id
    AND t.trip_id IS NOT NULL
  UNION
  SELECT as_client.id
  FROM (
    SELECT tr.id
    FROM public.trips tr
    JOIN unique_link u ON u.linked = tr.organization_id
    JOIN public.clients c ON c.id = tr.client_id
    WHERE tr.deleted_at IS NULL
      AND tr.indent_id IS NOT NULL
      AND c.linked_organization_id = p_org_id
    ORDER BY tr.created_at DESC
    LIMIT 400
  ) as_client;
$$;

REVOKE ALL ON FUNCTION public.supplier_page_trip_ids(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_page_trip_ids(uuid, uuid) TO authenticated;

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
    WITH scoped_ids AS (
      SELECT id FROM public.client_page_trip_ids(p_org_id, p_client_id)
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
      SELECT id FROM public.supplier_page_trip_ids(p_org_id, p_supplier_id)
    ),
    scoped_trips AS (
      SELECT DISTINCT ON (tr.id)
        CASE WHEN tr.organization_id = p_org_id THEN tr.client_price END AS client_price,
        CASE WHEN tr.organization_id = p_org_id THEN tr.margin END AS margin,
        CASE WHEN ts.rate IS NOT NULL THEN ts.rate ELSE tr.supplier_rate END AS supplier_rate,
        CASE
          WHEN ts.rate IS NOT NULL THEN COALESCE(tr.supplier_rate, tr.client_price)
          WHEN tr.organization_id IS DISTINCT FROM p_org_id THEN COALESCE(tr.client_price, tr.supplier_rate)
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
