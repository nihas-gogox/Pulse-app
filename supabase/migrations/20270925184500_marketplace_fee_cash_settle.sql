-- Temporary cash settlement for Marketplace platform fees until Razorpay
-- is live. Bidder (or winning org member) can mark the fee paid and post a
-- Cash OUT on the bidder org ledger (same MARKETPLACE_PLATFORM_FEE row
-- shape as trip-completion). Deploy RPCs then treat the award as paid.

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
      organization_id,
      trip_id,
      party_name,
      description,
      amount_out,
      amount_in,
      transaction_date,
      contact_id,
      contact_type,
      ledger_entity_type,
      ledger_flow_type,
      ledger_category,
      payment_ref
    ) VALUES (
      v_org,
      NULL,
      'Pulse Marketplace',
      'MARKETPLACE PLATFORM FEE CASH | Mode: Temporary cash settlement',
      v_bid.platform_fee_amount,
      0,
      (timezone('utc', now()))::date,
      NULL,
      NULL,
      'platform',
      'expense',
      'MARKETPLACE_PLATFORM_FEE',
      p_bid_id::text
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

COMMENT ON FUNCTION public.settle_marketplace_fee_as_cash(uuid) IS
  'Temporary cash settlement for an accepted Marketplace award: marks fee_payment_status=paid, records marketplace_fee_payments(provider=cash), and posts a Cash OUT MARKETPLACE_PLATFORM_FEE on the bidder org ledger. Replace with Razorpay confirm_marketplace_fee_payment when the gateway is live.';

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

-- Deploy no longer hard-fails when Razorpay is absent: settle as cash, then continue.
CREATE OR REPLACE FUNCTION public.create_trip_from_assigned_indent(p_indent_id uuid, p_driver_id uuid DEFAULT NULL::uuid, p_vehicle_id uuid DEFAULT NULL::uuid, p_vehicle_display_number text DEFAULT NULL::text)
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

  IF v_is_market_award AND v_market_bid.fee_payment_status NOT IN ('paid', 'not_required') THEN
    PERFORM public.settle_marketplace_fee_as_cash(v_market_bid.id);
    SELECT * INTO v_market_bid FROM public.market_bids WHERE id = v_market_bid.id;
    IF v_market_bid.fee_payment_status NOT IN ('paid', 'not_required') THEN
      RAISE EXCEPTION 'fee_payment_pending: platform fee must be paid before this Marketplace award can be deployed (bid %, current: %)', v_market_bid.id, v_market_bid.fee_payment_status;
    END IF;
  END IF;

  IF NOT v_is_market_award THEN
    IF NOT public.is_approved_supplier(v_org_id, v_supplier_org_id) THEN
      RAISE EXCEPTION 'Bidder is not an approved supplier of this load owner. Add and approve them as a supplier before deploying.'
        USING ERRCODE = 'insufficient_privilege';
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
    v_supplier_rate      := v_market_bid.amount;
    v_supplier_id        := NULL;
    v_source             := 'market_bid';
    v_source_market_bid_id := v_market_bid.id;
    v_client_price       := v_market_bid.amount;
    v_trip_platform_fee  := coalesce(v_market_bid.platform_fee_amount, 0);
    v_trip_fee_snapshot  := v_market_bid.platform_fee_calc_snapshot;
    v_trip_sale_basis    := 'per_trip';
  ELSE
    v_supplier_rate := COALESCE(
      (v_indent.assigned_supplier_rate)::numeric,
      v_indent.supplier_target,
      0
    );

    SELECT id INTO v_supplier_id
    FROM public.suppliers
    WHERE organization_id = v_org_id
      AND linked_organization_id = v_supplier_org_id
      AND is_active = true
    LIMIT 1;

    IF v_supplier_id IS NULL THEN
      RAISE EXCEPTION 'Bidder is not an approved supplier of this load owner. Add and approve them as a supplier before deploying.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    v_source              := 'indent';
    v_source_market_bid_id := NULL;
    v_client_price        := coalesce(v_indent.client_price, 0);
    v_trip_platform_fee    := 0;
    v_trip_fee_snapshot     := NULL;
    v_trip_sale_basis       := NULL;
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
