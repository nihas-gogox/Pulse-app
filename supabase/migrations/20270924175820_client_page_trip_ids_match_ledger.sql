-- Client bootstrap trip ids must match get_customer_ledger_inputs:
-- own-org trips only (client_id / name / ledger). No other-org dump.

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
