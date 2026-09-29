-- Trips hub e-way expiry tags read eway_bill rows through the same batch RPC as
-- LR/POD flags (avoids reintroducing the REST trip_documents IN-list that timed
-- out under RLS — see 20270922163000). Only change vs 20270922163000: add
-- 'eway_bill' to the document_type filter. Signature, return shape, visibility
-- scope and grants are unchanged. loadLrPodIndexByTripIds filters the extra rows.

CREATE OR REPLACE FUNCTION public.get_trip_documents_lr_pod_batch(p_trip_ids uuid[])
RETURNS TABLE (
  trip_id uuid,
  document_type text,
  document_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    td.trip_id,
    td.document_type,
    td.document_number
  FROM public.trip_documents td
  WHERE p_trip_ids IS NOT NULL
    AND cardinality(p_trip_ids) > 0
    AND td.trip_id = ANY (p_trip_ids)
    AND td.document_type IN ('lr', 'pod', 'soft_pod', 'pod_soft', 'eway_bill')
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = td.trip_id
        AND (
          public.is_org_member(t.organization_id)
          OR EXISTS (
            SELECT 1
            FROM public.suppliers s
            WHERE s.id = t.supplier_id
              AND s.linked_organization_id IS NOT NULL
              AND public.is_org_member(s.linked_organization_id)
          )
          OR EXISTS (
            SELECT 1
            FROM public.clients c
            WHERE c.id = t.client_id
              AND c.organization_id IS NOT NULL
              AND public.is_org_member(c.organization_id)
          )
          OR EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = t.driver_id
              AND d.user_id = (SELECT auth.uid())
          )
        )
    );
$$;

COMMENT ON FUNCTION public.get_trip_documents_lr_pod_batch(uuid[]) IS
  'Batch LR/POD/e-way bill trip_documents rows for hub/Overview. SECURITY DEFINER bypasses heavy '
  'trip_documents SELECT RLS; caller must be trip owner-org member, supplier-linked org '
  'member, client-linked org member, or assigned driver.';

REVOKE ALL ON FUNCTION public.get_trip_documents_lr_pod_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trip_documents_lr_pod_batch(uuid[]) TO authenticated;
