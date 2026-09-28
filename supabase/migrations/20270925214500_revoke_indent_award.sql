-- Revoke an indent award and return the load to open bidding.
-- Cheap: PK lock on one indent, indexed child updates only.
-- Does not raise max_connections. 8s statement timeout.
-- Blocks if an active trip exists or the Marketplace fee is already paid.

ALTER TABLE public.indents
  ADD COLUMN IF NOT EXISTS award_revoked_at timestamptz;

COMMENT ON COLUMN public.indents.award_revoked_at IS
  'Set when a shipper revokes an award and reopens bidding. Cleared automatically on the next award.';

CREATE OR REPLACE FUNCTION public.tg_clear_award_revoked_on_award()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(trim(coalesce(NEW.status, ''))) = 'awarded'
     AND lower(trim(coalesce(OLD.status, ''))) IS DISTINCT FROM 'awarded'
  THEN
    NEW.award_revoked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_award_revoked_on_award ON public.indents;
CREATE TRIGGER trg_clear_award_revoked_on_award
  BEFORE UPDATE OF status ON public.indents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_clear_award_revoked_on_award();

CREATE OR REPLACE FUNCTION public.revoke_indent_award(p_indent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $function$
DECLARE
  v_indent public.indents%ROWTYPE;
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized: sign in required';
  END IF;

  SELECT * INTO v_indent
  FROM public.indents
  WHERE id = p_indent_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: indent %', p_indent_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_indent.organization_id
      AND om.user_id = v_uid
      AND om.status = 'active'
      AND om.role <> 'driver'
  ) THEN
    RAISE EXCEPTION 'unauthorized: caller must be a non-driver member of the owning organization';
  END IF;

  IF lower(trim(coalesce(v_indent.status, ''))) <> 'awarded' THEN
    RAISE EXCEPTION 'invalid_state: indent is not awarded (status=%)', v_indent.status;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.indent_id = v_indent.id
      AND t.deleted_at IS NULL
      AND t.status IS DISTINCT FROM 'cancelled'
  ) THEN
    RAISE EXCEPTION 'trip_exists: cancel the trip before revoking this award';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.market_bids mb
    WHERE mb.indent_id = v_indent.id
      AND mb.status = 'accepted'
      AND mb.fee_payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'fee_paid: marketplace fee is already paid for this award';
  END IF;

  UPDATE public.market_bids
  SET
    status = 'pending',
    accepted_at = NULL,
    updated_at = now(),
    fee_payment_status = CASE
      WHEN fee_payment_status IN ('required', 'pending', 'failed') THEN 'not_required'
      ELSE fee_payment_status
    END
  WHERE indent_id = v_indent.id
    AND status IN ('accepted', 'rejected', 'superseded');

  UPDATE public.direct_quotes
  SET status = 'pending', updated_at = now()
  WHERE indent_id = v_indent.id
    AND status IN ('accepted', 'rejected');

  UPDATE public.driver_direct_bids ddb
  SET status = 'pending', updated_at = now()
  WHERE ddb.status IN ('accepted', 'rejected', 'superseded')
    AND ddb.post_id IN (
      SELECT p.id FROM public.posts p WHERE p.source_indent_id = v_indent.id
    );

  UPDATE public.bids b
  SET status = 'pending', updated_at = now()
  WHERE b.status IN ('accepted', 'rejected')
    AND b.post_id IN (
      SELECT p.id FROM public.posts p WHERE p.source_indent_id = v_indent.id
    );

  UPDATE public.posts p
  SET is_active = true, updated_at = now()
  WHERE p.id = (
    SELECT p2.id
    FROM public.posts p2
    WHERE p2.source_indent_id = v_indent.id
    ORDER BY p2.created_at DESC NULLS LAST
    LIMIT 1
  )
    AND p.is_active IS DISTINCT FROM true;

  UPDATE public.indents
  SET
    status = 'open',
    assigned_supplier_id = NULL,
    assigned_supplier_rate = NULL,
    award_revoked_at = now(),
    updated_at = now()
  WHERE id = v_indent.id;

  RETURN jsonb_build_object(
    'ok', true,
    'indent_id', p_indent_id,
    'status', 'open',
    'award_revoked_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_indent_award(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_indent_award(uuid) TO authenticated;

COMMENT ON FUNCTION public.revoke_indent_award(uuid) IS
  'Shipper-only: reopen an awarded indent (no active trip, unpaid fee). Restores competing bids to pending and stamps award_revoked_at.';
