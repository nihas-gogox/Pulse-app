-- Marketplace awards must convert without a Network suppliers row (ADR-012 /
-- MARKETPLACE_DOMAIN: awarding does not create a Network connection).
-- Network loads already only reach the shipper's suppliers at bid time, so
-- convert must not re-check is_approved_supplier. Also recreates cash-fee
-- settle RPCs if 20270925184500 is not on remote yet (404 on convert).

CREATE OR REPLACE FUNCTION public.ensure_awarded_bidder_supplier(
  p_owner_org uuid,
  p_bidder_org uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  IF p_owner_org IS NULL OR p_bidder_org IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.suppliers s
  WHERE s.organization_id = p_owner_org
    AND s.linked_organization_id = p_bidder_org
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.suppliers
    SET is_active = true, updated_at = now()
    WHERE id = v_id AND coalesce(is_active, true) IS DISTINCT FROM true;
    RETURN v_id;
  END IF;

  SELECT coalesce(nullif(trim(o.name), ''), 'Supplier') INTO v_name
  FROM public.organizations o
  WHERE o.id = p_bidder_org;

  INSERT INTO public.suppliers (
    organization_id, name, linked_organization_id, supplier_type, is_active, updated_at
  ) VALUES (
    p_owner_org, coalesce(v_name, 'Supplier'), p_bidder_org, 'integrated', true, now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT s.id INTO v_id
    FROM public.suppliers s
    WHERE s.organization_id = p_owner_org
      AND s.linked_organization_id = p_bidder_org
    LIMIT 1;
    RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_awarded_bidder_supplier(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_awarded_bidder_supplier(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_marketplace_indent_award(
  p_indent_id uuid,
  p_bidder_org uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.market_bids mb
      WHERE mb.indent_id = p_indent_id
        AND mb.status = 'accepted'
        AND (
          p_bidder_org IS NULL
          OR mb.bidder_organization_id = p_bidder_org
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.indents i
      WHERE i.id = p_indent_id
        AND lower(coalesce(i.circulation_target, '')) IN ('marketplace', 'both')
    );
$function$;

REVOKE ALL ON FUNCTION public.is_marketplace_indent_award(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_marketplace_indent_award(uuid, uuid) TO authenticated;

-- Recreate cash settle so convert does not 404 when 184500 is not remote yet.
CREATE OR REPLACE FUNCTION public.settle_marketplace_fee_as_cash(p_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bid public.market_bids%ROWTYPE;
  v_uid uuid := auth.uid();
  v_org uuid;
  v_tx_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized: sign in required';
  END IF;

  SELECT * INTO v_bid FROM public.market_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: bid %', p_bid_id;
  END IF;

  IF v_bid.fee_payment_status IN ('paid', 'not_required') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'fee_payment_status', v_bid.fee_payment_status,
      'note', 'already_settled'
    );
  END IF;

  IF v_bid.status <> 'accepted' THEN
    RAISE EXCEPTION 'invalid_state: bid % is not an accepted award (current: %)',
      p_bid_id, v_bid.status;
  END IF;

  IF v_uid <> v_bid.bidder_user_id
     AND NOT (
       v_bid.bidder_organization_id IS NOT NULL
       AND public.is_org_member(v_bid.bidder_organization_id)
     ) THEN
    RAISE EXCEPTION 'unauthorized: only the winning bidder can settle this fee';
  END IF;

  IF coalesce(v_bid.platform_fee_amount, 0) <= 0 THEN
    UPDATE public.market_bids
    SET fee_payment_status = 'not_required', updated_at = now()
    WHERE id = p_bid_id;
    RETURN jsonb_build_object('ok', true, 'fee_payment_status', 'not_required');
  END IF;

  IF to_regclass('public.marketplace_fee_payments') IS NOT NULL THEN
    UPDATE public.marketplace_fee_payments
    SET status = 'cancelled', updated_at = now()
    WHERE market_bid_id = p_bid_id AND status = 'pending';

    INSERT INTO public.marketplace_fee_payments (
      market_bid_id, bidder_type, bidder_user_id, bidder_organization_id,
      amount, provider, provider_order_id, provider_payment_id, provider_event_id,
      status, paid_at
    ) VALUES (
      p_bid_id,
      v_bid.bidder_type,
      v_bid.bidder_user_id,
      v_bid.bidder_organization_id,
      v_bid.platform_fee_amount,
      'cash',
      'cash_order_' || gen_random_uuid()::text,
      'cash_payment_' || gen_random_uuid()::text,
      'cash_event_' || gen_random_uuid()::text,
      'paid',
      now()
    );
  END IF;

  UPDATE public.market_bids
  SET fee_payment_status = 'paid', updated_at = now()
  WHERE id = p_bid_id;

  v_org := v_bid.bidder_organization_id;
  IF v_org IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.organization_id = v_org
      AND t.ledger_category = 'MARKETPLACE_PLATFORM_FEE'
      AND t.payment_ref = p_bid_id::text
  ) THEN
    INSERT INTO public.transactions (
      organization_id, trip_id, party_name, description,
      amount_out, amount_in, transaction_date,
      contact_id, contact_type, ledger_entity_type, ledger_flow_type,
      ledger_category, payment_ref
    ) VALUES (
      v_org, NULL, 'Pulse Marketplace',
      'MARKETPLACE PLATFORM FEE CASH | Mode: Temporary cash settlement',
      v_bid.platform_fee_amount, 0, (timezone('utc', now()))::date,
      NULL, NULL, 'platform', 'expense', 'MARKETPLACE_PLATFORM_FEE', p_bid_id::text
    )
    RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'fee_payment_status', 'paid',
    'amount', v_bid.platform_fee_amount,
    'transaction_id', v_tx_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_marketplace_fee_as_cash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_marketplace_fee_as_cash(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_marketplace_fee_as_cash_for_indent(p_indent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bid_id uuid;
BEGIN
  SELECT mb.id INTO v_bid_id
  FROM public.market_bids mb
  WHERE mb.indent_id = p_indent_id
    AND mb.status = 'accepted'
    AND (
      mb.bidder_user_id = (select auth.uid())
      OR (
        mb.bidder_organization_id IS NOT NULL
        AND public.is_org_member(mb.bidder_organization_id)
      )
    )
  ORDER BY mb.accepted_at DESC NULLS LAST, mb.updated_at DESC
  LIMIT 1;

  IF v_bid_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'note', 'no_market_award');
  END IF;

  RETURN public.settle_marketplace_fee_as_cash(v_bid_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_marketplace_fee_as_cash_for_indent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_marketplace_fee_as_cash_for_indent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_trip_from_direct_quote(
  p_quote_id uuid,
  p_vehicle_display_number text DEFAULT NULL::text
)
RETURNS SETOF trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote              public.direct_quotes%ROWTYPE;
  v_indent             public.indents%ROWTYPE;
  v_supplier_id        uuid;
  v_org_id             uuid;
  v_trip               public.trips%ROWTYPE;
  v_vehicle_display    text;
  v_try                integer := 0;
  v_actor_user_id      uuid := auth.uid();
  v_created_by_user_id uuid := NULL;
  v_is_marketplace     boolean := false;
BEGIN
  v_vehicle_display := NULLIF(TRIM(COALESCE(p_vehicle_display_number, '')), '');

  IF v_actor_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, name)
    VALUES (v_actor_user_id, 'User')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id INTO v_created_by_user_id
  FROM public.users
  WHERE id = v_actor_user_id
  LIMIT 1;

  SELECT * INTO v_quote FROM public.direct_quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Direct quote not found';
  END IF;
  IF (v_quote.status IS NULL OR lower(v_quote.status) <> 'accepted') THEN
    RAISE EXCEPTION 'Quote must be accepted before creating a trip';
  END IF;

  SELECT * INTO v_indent FROM public.indents WHERE id = (v_quote).indent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indent not found';
  END IF;

  v_org_id := v_indent.organization_id;

  IF NOT (
    public.is_org_member(v_org_id) OR public.is_org_member((v_quote).bidder_organization_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to create trip from this quote';
  END IF;

  v_is_marketplace := public.is_marketplace_indent_award(
    (v_quote).indent_id,
    (v_quote).bidder_organization_id
  );

  -- Marketplace: open-market winner, no Network suppliers row (ADR-012).
  -- Network: bid visibility already required a supplier; ensure the row
  -- instead of blocking convert.
  IF v_is_marketplace THEN
    v_supplier_id := NULL;
  ELSE
    v_supplier_id := public.ensure_awarded_bidder_supplier(
      v_org_id,
      (v_quote).bidder_organization_id
    );
  END IF;

  SELECT t.* INTO v_trip
  FROM public.trips t
  WHERE t.indent_id = (v_quote).indent_id
  LIMIT 1;
  IF FOUND THEN
    UPDATE public.trips
    SET
      driver_id = COALESCE((v_quote).driver_id, driver_id),
      vehicle_id = COALESCE((v_quote).vehicle_id, vehicle_id),
      updated_at = now(),
      vehicle_display_number = CASE
        WHEN v_vehicle_display IS NOT NULL THEN v_vehicle_display
        ELSE vehicle_display_number
      END
    WHERE id = (v_trip).id;
    SELECT * INTO v_trip FROM public.trips WHERE id = (v_trip).id;
    UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = (v_quote).indent_id;

    PERFORM public._ensure_mover_asset_trip(
      (v_quote).indent_id,
      (v_trip).driver_id,
      (v_trip).vehicle_id,
      (v_trip).vehicle_display_number,
      v_created_by_user_id
    );

    RETURN NEXT v_trip;
    RETURN;
  END IF;

  LOOP
    v_try := v_try + 1;
    BEGIN
      INSERT INTO public.trips (
        organization_id, owner_user_id, created_by_user_id,
        trip_number, indent_id, source,
        pickup_area, drop_location, client_name,
        client_price, supplier_rate, supplier_id, trip_payout_mode,
        driver_id, vehicle_id, status,
        pickup_date, load_type, vehicle_display_number,
        platform_fee, driver_commission, payment_status, amount_paid
      ) VALUES (
        v_org_id, (v_indent).owner_user_id, v_created_by_user_id,
        '', (v_quote).indent_id, 'direct_quote',
        coalesce((v_indent).pickup_area, ''), coalesce((v_indent).drop_location, ''),
        coalesce((v_indent).client_name, ''),
        coalesce((v_indent).client_price, 0), coalesce((v_quote).amount, 0), v_supplier_id,
        CASE
          WHEN (v_quote).driver_id IS NOT NULL
           AND (v_quote).vehicle_id IS NOT NULL
           AND v_supplier_id IS NULL THEN 'asset'
          ELSE 'market'
        END,
        (v_quote).driver_id, (v_quote).vehicle_id, 'assigned',
        (v_indent).pickup_date, coalesce((v_indent).load_type, ''),
        v_vehicle_display, 0, 0, 'pending', 0
      )
      RETURNING * INTO v_trip;

      UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = (v_quote).indent_id;

      PERFORM public._ensure_mover_asset_trip(
        (v_quote).indent_id,
        (v_quote).driver_id,
        (v_quote).vehicle_id,
        v_vehicle_display,
        v_created_by_user_id
      );

      RETURN NEXT v_trip;
      RETURN;

    EXCEPTION
      WHEN unique_violation THEN
        SELECT t.* INTO v_trip
        FROM public.trips t
        WHERE t.indent_id = (v_quote).indent_id
        LIMIT 1;
        IF FOUND THEN
          UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = (v_quote).indent_id;
          PERFORM public._ensure_mover_asset_trip(
            (v_quote).indent_id,
            (v_trip).driver_id,
            (v_trip).vehicle_id,
            (v_trip).vehicle_display_number,
            v_created_by_user_id
          );
          RETURN NEXT v_trip;
          RETURN;
        END IF;

        INSERT INTO public.organization_counters (organization_id, trip_seq)
        VALUES (v_org_id, 0)
        ON CONFLICT (organization_id) DO NOTHING;

        UPDATE public.organization_counters oc
        SET trip_seq = greatest(
          oc.trip_seq,
          coalesce((
            SELECT max(
              CASE
                WHEN t.trip_number ~ '[0-9]+$'
                THEN (regexp_match(t.trip_number, '([0-9]+)$'))[1]::bigint
                ELSE 0
              END
            )
            FROM public.trips t
            WHERE t.organization_id = v_org_id
          ), 0)
        )
        WHERE oc.organization_id = v_org_id;

        IF v_try >= 3 THEN
          RAISE EXCEPTION 'Could not create trip: repeated unique conflict after counter sync';
        END IF;
    END;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.create_trip_from_direct_quote(uuid, text) IS
  'Create a trip from an accepted quote. Marketplace awards skip Network supplier eligibility (ADR-012). Network awards ensure the shipper supplier row instead of failing convert.';

REVOKE ALL ON FUNCTION public.create_trip_from_direct_quote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trip_from_direct_quote(uuid, text) TO authenticated;

-- Assigned-indent deploy: drop Network-only 42501 gates.
CREATE OR REPLACE FUNCTION public.create_trip_from_assigned_indent(
  p_indent_id uuid,
  p_driver_id uuid DEFAULT NULL::uuid,
  p_vehicle_id uuid DEFAULT NULL::uuid,
  p_vehicle_display_number text DEFAULT NULL::text
)
RETURNS SETOF trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_indent             public.indents%ROWTYPE;
  v_org_id             uuid;
  v_supplier_org_id    uuid;
  v_supplier_id        uuid;
  v_trip               public.trips%ROWTYPE;
  v_vehicle_display    text;
  v_supplier_rate      numeric;
  v_actor_user_id      uuid := auth.uid();
  v_created_by_user_id uuid := NULL;
  v_try                integer := 0;
  v_market_bid         public.market_bids%ROWTYPE;
  v_is_market_award    boolean := false;
  v_source             text := 'indent';
  v_source_market_bid_id uuid := NULL;
  v_client_price       numeric;
  v_trip_platform_fee  numeric := 0;
  v_trip_fee_snapshot  jsonb := NULL;
  v_trip_sale_basis    text := NULL;
BEGIN
  v_vehicle_display := NULLIF(TRIM(COALESCE(p_vehicle_display_number, '')), '');

  IF v_actor_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, name)
    VALUES (v_actor_user_id, 'User')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id INTO v_created_by_user_id
  FROM public.users
  WHERE id = v_actor_user_id
  LIMIT 1;

  SELECT * INTO v_indent FROM public.indents WHERE id = p_indent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indent % not found', p_indent_id;
  END IF;

  IF lower(coalesce(v_indent.status, '')) IN ('cancelled', 'closed') THEN
    RAISE EXCEPTION 'Cannot create trip: indent % is not available', p_indent_id;
  END IF;

  v_supplier_org_id := v_indent.assigned_supplier_id;
  IF v_supplier_org_id IS NULL THEN
    RAISE EXCEPTION 'Indent has no assigned supplier';
  END IF;

  IF NOT public.is_org_member(v_supplier_org_id) THEN
    RAISE EXCEPTION 'Not authorized to deploy this load';
  END IF;

  v_org_id := v_indent.organization_id;

  SELECT * INTO v_market_bid
  FROM public.market_bids
  WHERE indent_id = p_indent_id
    AND bidder_type = 'organization'
    AND bidder_organization_id = v_supplier_org_id
    AND status = 'accepted'
  LIMIT 1;
  v_is_market_award := FOUND;

  IF NOT v_is_market_award THEN
    v_is_market_award := public.is_marketplace_indent_award(p_indent_id, v_supplier_org_id);
    IF v_is_market_award THEN
      SELECT * INTO v_market_bid
      FROM public.market_bids
      WHERE indent_id = p_indent_id
        AND status = 'accepted'
      ORDER BY accepted_at DESC NULLS LAST, updated_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_is_market_award AND v_market_bid.id IS NOT NULL
     AND v_market_bid.fee_payment_status NOT IN ('paid', 'not_required') THEN
    IF to_regprocedure('public.settle_marketplace_fee_as_cash(uuid)') IS NOT NULL THEN
      PERFORM public.settle_marketplace_fee_as_cash(v_market_bid.id);
      SELECT * INTO v_market_bid FROM public.market_bids WHERE id = v_market_bid.id;
    END IF;
    IF v_market_bid.fee_payment_status NOT IN ('paid', 'not_required') THEN
      RAISE EXCEPTION 'fee_payment_pending: platform fee must be paid before this Marketplace award can be deployed (bid %, current: %)', v_market_bid.id, v_market_bid.fee_payment_status;
    END IF;
  END IF;

  IF coalesce(trim(v_indent.pickup_area), '') = '' THEN
    RAISE EXCEPTION 'Cannot create trip: indent % has no pickup_area', p_indent_id;
  END IF;
  IF coalesce(trim(v_indent.drop_location), '') = '' THEN
    RAISE EXCEPTION 'Cannot create trip: indent % has no drop_location', p_indent_id;
  END IF;
  IF NOT public.indent_has_convertible_sale(v_indent) THEN
    RAISE EXCEPTION 'Cannot create trip: indent % has no client_price', p_indent_id;
  END IF;

  IF p_driver_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = p_driver_id AND d.organization_id = v_supplier_org_id
    ) THEN
      RAISE EXCEPTION 'Driver must belong to your organization';
    END IF;
  END IF;

  IF p_vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = p_vehicle_id AND v.organization_id = v_supplier_org_id
    ) THEN
      RAISE EXCEPTION 'Vehicle must belong to your organization';
    END IF;
  END IF;

  SELECT t.* INTO v_trip
  FROM public.trips t
  WHERE t.indent_id = p_indent_id
  LIMIT 1;

  IF FOUND THEN
    IF lower(coalesce(v_trip.status, '')) NOT IN ('completed', 'cancelled') THEN
      UPDATE public.trips
      SET
        driver_id = COALESCE(p_driver_id, driver_id),
        vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
        vehicle_display_number = CASE
          WHEN v_vehicle_display IS NOT NULL THEN v_vehicle_display
          ELSE vehicle_display_number
        END,
        updated_at = now()
      WHERE id = v_trip.id;
      SELECT * INTO v_trip FROM public.trips WHERE id = v_trip.id;
    END IF;
    UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = p_indent_id;
    RETURN NEXT v_trip;
    RETURN;
  END IF;

  IF v_is_market_award THEN
    v_supplier_rate := COALESCE(v_market_bid.amount, v_indent.assigned_supplier_rate, v_indent.supplier_target, 0);
    v_supplier_id := NULL;
    v_source := 'market_bid';
    v_source_market_bid_id := v_market_bid.id;
    v_client_price := COALESCE(v_market_bid.amount, v_indent.assigned_supplier_rate, v_indent.client_price, 0);
    v_trip_platform_fee := coalesce(v_market_bid.platform_fee_amount, 0);
    v_trip_fee_snapshot := v_market_bid.platform_fee_calc_snapshot;
    v_trip_sale_basis := 'per_trip';
  ELSE
    v_supplier_rate := COALESCE(
      (v_indent.assigned_supplier_rate)::numeric,
      v_indent.supplier_target,
      0
    );
    v_supplier_id := public.ensure_awarded_bidder_supplier(v_org_id, v_supplier_org_id);
    v_source := 'indent';
    v_source_market_bid_id := NULL;
    v_client_price := coalesce(v_indent.client_price, 0);
    v_trip_platform_fee := 0;
    v_trip_fee_snapshot := NULL;
    v_trip_sale_basis := NULL;
  END IF;

  LOOP
    v_try := v_try + 1;
    BEGIN
      INSERT INTO public.trips (
        organization_id, owner_user_id, created_by_user_id, trip_number, indent_id,
        source, source_market_bid_id, pickup_area, drop_location, client_name, client_price, supplier_rate,
        supplier_id, trip_payout_mode, driver_id, vehicle_id, status, pickup_date,
        load_type, vehicle_display_number, platform_fee, driver_commission,
        payment_status, amount_paid, platform_fee_calc_snapshot, sale_rate_basis
      ) VALUES (
        v_org_id, v_indent.owner_user_id, v_created_by_user_id, '', p_indent_id,
        v_source, v_source_market_bid_id, coalesce(v_indent.pickup_area, ''), coalesce(v_indent.drop_location, ''),
        coalesce(v_indent.client_name, ''),
        v_client_price,
        v_supplier_rate, v_supplier_id,
        CASE WHEN v_supplier_id IS NOT NULL THEN 'market' ELSE 'asset' END,
        p_driver_id, p_vehicle_id,
        CASE WHEN p_driver_id IS NOT NULL THEN 'assigned' ELSE 'draft' END,
        v_indent.pickup_date, coalesce(v_indent.load_type, ''), v_vehicle_display,
        v_trip_platform_fee, 0, 'pending', 0,
        v_trip_fee_snapshot,
        v_trip_sale_basis
      )
      RETURNING * INTO v_trip;

      UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = p_indent_id;
      RETURN NEXT v_trip;
      RETURN;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT t.* INTO v_trip
        FROM public.trips t
        WHERE t.indent_id = p_indent_id
        LIMIT 1;
        IF FOUND THEN
          UPDATE public.indents SET status = 'completed', updated_at = now() WHERE id = p_indent_id;
          RETURN NEXT v_trip;
          RETURN;
        END IF;
        IF v_try >= 3 THEN
          RAISE;
        END IF;
    END;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.create_trip_from_assigned_indent(uuid, uuid, uuid, text) IS
  'Deploy an awarded indent. Marketplace awards do not require a Network suppliers row. Network awards ensure the shipper supplier row instead of raising 42501.';

REVOKE ALL ON FUNCTION public.create_trip_from_assigned_indent(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trip_from_assigned_indent(uuid, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_indent_assigned_supplier_on_quote_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_org uuid;
BEGIN
  IF new.status = 'accepted' THEN
    SELECT i.organization_id INTO v_owner_org
    FROM public.indents i
    WHERE i.id = new.indent_id;

    IF v_owner_org IS NULL THEN
      RAISE EXCEPTION 'Indent % not found', new.indent_id;
    END IF;

    -- Network-only: bid visibility already required a supplier.
    -- Marketplace: do not require a Network suppliers row (ADR-012).
    IF NOT public.is_marketplace_indent_award(new.indent_id, new.bidder_organization_id)
       AND NOT public.is_approved_supplier(v_owner_org, new.bidder_organization_id) THEN
      PERFORM public.ensure_awarded_bidder_supplier(v_owner_org, new.bidder_organization_id);
    END IF;

    UPDATE public.indents
    SET
      assigned_supplier_id = new.bidder_organization_id,
      assigned_supplier_rate = new.amount,
      status = CASE
        WHEN lower(coalesce(status, '')) IN (
          'awarded', 'completed', 'cancelled', 'closed', 'expired'
        ) THEN status
        ELSE 'awarded'
      END,
      updated_at = now()
    WHERE id = new.indent_id;
  END IF;
  RETURN new;
END;
$function$;
