-- Marketplace discovery: require from / to / vehicle and page with OFFSET
-- so Find Loads does not scan the open-market feed on first paint.

DROP FUNCTION IF EXISTS public.list_open_marketplace_loads_for_org(uuid, integer);

CREATE OR REPLACE FUNCTION public.list_open_marketplace_loads_for_org(
  p_org_id uuid,
  p_limit integer DEFAULT 15,
  p_offset integer DEFAULT 0,
  p_pickup text DEFAULT NULL,
  p_drop text DEFAULT NULL,
  p_vehicle_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  indent_number text,
  pickup_area text,
  drop_location text,
  vehicle_type text,
  load_type text,
  pickup_date date,
  status text,
  circulation_target text,
  rate_offer numeric,
  creator_organization_id uuid,
  creator_organization_name text,
  created_at timestamptz,
  is_sponsored boolean,
  reach_campaign_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 15), 15));
  v_offset integer := GREATEST(0, LEAST(COALESCE(p_offset, 0), 150));
  v_pickup text := lower(trim(coalesce(p_pickup, '')));
  v_drop text := lower(trim(coalesce(p_drop, '')));
  v_vehicle text := lower(trim(coalesce(p_vehicle_type, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Empty result unless the caller searched — never dump the full market.
  IF char_length(v_pickup) < 2 OR char_length(v_drop) < 2 OR char_length(v_vehicle) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.indent_number,
    i.pickup_area,
    i.drop_location,
    i.vehicle_type,
    i.load_type,
    i.pickup_date,
    i.status::text,
    i.circulation_target::text,
    i.supplier_target::numeric AS rate_offer,
    i.organization_id AS creator_organization_id,
    o.name AS creator_organization_name,
    i.created_at,
    (rc.id IS NOT NULL) AS is_sponsored,
    rc.id AS reach_campaign_id
  FROM public.indents i
  LEFT JOIN public.organizations o ON o.id = i.organization_id
  LEFT JOIN LATERAL (
    SELECT c.id
    FROM public.reach_campaigns c
    JOIN public.reach_campaign_targets t ON t.campaign_id = c.id
    WHERE t.org_id = p_org_id
      AND t.released_at IS NOT NULL
      AND c.archived_at IS NULL
      AND c.status = 'active'
      AND (c.expires_at IS NULL OR c.expires_at > now())
      AND (
        c.snapshot_source_indent_id = i.id
        OR c.post_id IN (
          SELECT p.id FROM public.posts p WHERE p.source_indent_id = i.id
        )
      )
    ORDER BY c.created_at DESC
    LIMIT 1
  ) rc ON true
  WHERE i.deleted_at IS NULL
    AND i.organization_id <> p_org_id
    AND lower(trim(coalesce(i.circulation_target, ''))) IN ('marketplace', 'both')
    AND position(v_pickup IN lower(coalesce(i.pickup_area, ''))) > 0
    AND position(v_drop IN lower(coalesce(i.drop_location, ''))) > 0
    AND position(v_vehicle IN lower(coalesce(i.vehicle_type, ''))) > 0
    AND public.indent_open_for_marketplace_bids(i.id)
  ORDER BY (rc.id IS NOT NULL) DESC NULLS LAST, i.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.list_open_marketplace_loads_for_org(uuid, integer, integer, text, text, text) IS
  'A4.1 search: open Marketplace/both indents matching pickup, drop, and vehicle. Empty unless all three filters are set. Discovery only — membership-gated, not bid eligibility.';

REVOKE ALL ON FUNCTION public.list_open_marketplace_loads_for_org(uuid, integer, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_open_marketplace_loads_for_org(uuid, integer, integer, text, text, text) TO authenticated;
