-- Awarded suppliers who sub-deploy a shipper-owned trip store the partner on
-- trip_subcontracts (viewer_org_id), not trips.supplier_id. Include those
-- payables in get_supplier_ledger_aggregation so Finance cards match the
-- client overlay used by the suppliers tab.

CREATE OR REPLACE FUNCTION public.get_supplier_ledger_aggregation(p_org_id uuid, p_apply_adjustments boolean DEFAULT true)
RETURNS TABLE (
  supplier_id uuid,
  trips_count integer,
  due numeric,
  paid numeric,
  unsettled numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH supplier_linked_org_index AS (
    SELECT DISTINCT ON (linked_organization_id)
      linked_organization_id, id AS supplier_id
    FROM public.suppliers
    WHERE organization_id = p_org_id AND linked_organization_id IS NOT NULL
    ORDER BY linked_organization_id, id ASC
  ),
  trip_supplier_resolution AS (
    SELECT
      t.id AS trip_id,
      t.trip_number,
      t.supplier_rate,
      s_id.id AS supplier_id
    FROM public.trips t
    LEFT JOIN public.suppliers s_id
      ON s_id.id = t.supplier_id AND s_id.organization_id = p_org_id
    WHERE t.organization_id = p_org_id
  ),
  trip_cost_adjustments AS (
    SELECT trip_id, sum(CASE WHEN impact = 'plus' THEN amount ELSE -amount END) AS delta
    FROM public.trip_finance_adjustments
    WHERE type = 'cost' AND voided_at IS NULL
    GROUP BY trip_id
  ),
  trip_revenue_adjustments AS (
    SELECT trip_id, sum(CASE WHEN impact = 'plus' THEN amount ELSE -amount END) AS delta
    FROM public.trip_finance_adjustments
    WHERE type = 'revenue' AND voided_at IS NULL
    GROUP BY trip_id
  ),
  own_trip_cost AS (
    SELECT
      tsr.supplier_id,
      count(*)::int AS trips_count,
      sum(
        CASE WHEN p_apply_adjustments
          THEN greatest(0, coalesce(tsr.supplier_rate, 0) + coalesce(tca.delta, 0))
          ELSE coalesce(tsr.supplier_rate, 0)
        END
      ) AS due
    FROM trip_supplier_resolution tsr
    LEFT JOIN trip_cost_adjustments tca ON tca.trip_id = tsr.trip_id
    WHERE tsr.supplier_id IS NOT NULL
    GROUP BY tsr.supplier_id
  ),
  subcontract_trip_cost AS (
    SELECT
      ts.supplier_id,
      count(*)::int AS trips_count,
      sum(
        CASE WHEN p_apply_adjustments
          THEN greatest(0, coalesce(ts.rate, 0) + coalesce(tca.delta, 0))
          ELSE coalesce(ts.rate, 0)
        END
      ) AS due
    FROM public.trip_subcontracts ts
    JOIN public.trips t ON t.id = ts.trip_id
    JOIN public.suppliers s
      ON s.id = ts.supplier_id AND s.organization_id = p_org_id
    LEFT JOIN trip_cost_adjustments tca ON tca.trip_id = ts.trip_id
    WHERE ts.viewer_org_id = p_org_id
      AND t.organization_id IS DISTINCT FROM p_org_id
    GROUP BY ts.supplier_id
  ),
  as_client_cost AS (
    SELECT
      sloi.supplier_id,
      count(*)::int AS trips_count,
      sum(
        CASE WHEN p_apply_adjustments
          THEN greatest(0, coalesce(t.client_price, t.supplier_rate, 0) + coalesce(tra.delta, 0))
          ELSE coalesce(t.client_price, t.supplier_rate, 0)
        END
      ) AS due
    FROM public.trips t
    JOIN public.clients c ON c.id = t.client_id
    JOIN supplier_linked_org_index sloi ON sloi.linked_organization_id = t.organization_id
    LEFT JOIN trip_revenue_adjustments tra ON tra.trip_id = t.id
    WHERE c.linked_organization_id = p_org_id
      AND t.indent_id IS NOT NULL
    GROUP BY sloi.supplier_id
  ),
  supplier_trip_ids_by_number AS (
    SELECT trip_number, supplier_id
    FROM trip_supplier_resolution
    WHERE trip_number IS NOT NULL AND supplier_id IS NOT NULL
  ),
  supplier_paid AS (
    SELECT
      coalesce(s_direct.id, sti.supplier_id, stn.supplier_id) AS supplier_id,
      sum(tx.amount_out) AS paid
    FROM public.transactions tx
    LEFT JOIN public.suppliers s_direct
      ON s_direct.id = tx.contact_id AND s_direct.organization_id = p_org_id AND tx.contact_type = 'supplier'
    LEFT JOIN trip_supplier_resolution sti
      ON sti.trip_id = tx.trip_id AND s_direct.id IS NULL
    LEFT JOIN supplier_trip_ids_by_number stn
      ON s_direct.id IS NULL AND sti.supplier_id IS NULL
     AND stn.trip_number = public.extract_ledger_meta_trip_number(tx.description)
    WHERE tx.organization_id = p_org_id
      AND coalesce(tx.amount_out, 0) > 0
      AND (s_direct.id IS NOT NULL OR sti.supplier_id IS NOT NULL OR stn.supplier_id IS NOT NULL)
    GROUP BY coalesce(s_direct.id, sti.supplier_id, stn.supplier_id)
  )
  SELECT
    s.id AS supplier_id,
    coalesce(otc.trips_count, 0) + coalesce(stc.trips_count, 0) + coalesce(acc.trips_count, 0) AS trips_count,
    coalesce(otc.due, 0) + coalesce(stc.due, 0) + coalesce(acc.due, 0) AS due,
    coalesce(sp.paid, 0) AS paid,
    greatest(
      0,
      (coalesce(otc.due, 0) + coalesce(stc.due, 0) + coalesce(acc.due, 0)) - coalesce(sp.paid, 0)
    ) AS unsettled
  FROM public.suppliers s
  LEFT JOIN own_trip_cost otc ON otc.supplier_id = s.id
  LEFT JOIN subcontract_trip_cost stc ON stc.supplier_id = s.id
  LEFT JOIN as_client_cost acc ON acc.supplier_id = s.id
  LEFT JOIN supplier_paid sp ON sp.supplier_id = s.id
  WHERE s.organization_id = p_org_id
    AND public.is_org_member(p_org_id);
$function$;

REVOKE ALL ON FUNCTION public.get_supplier_ledger_aggregation(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_ledger_aggregation(uuid, boolean) TO authenticated;
