-- Commerce merged fulfillment is self-distribution.
-- When the fulfillment trip completes, the sales orders on that plan are
-- Fulfilled. Product revenue stays on the order customer. Supplier cost
-- stays on the trip (supplier_rate / DCO) and is not copied into client_price.

CREATE OR REPLACE FUNCTION public.fulfill_commerce_orders_for_completed_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF lower(coalesce(NEW.status, '')) = 'completed'
     AND lower(coalesce(OLD.status, '')) IS DISTINCT FROM 'completed'
     AND NEW.indent_id IS NOT NULL THEN
    UPDATE public.sales_orders so
    SET status = 'Fulfilled', updated_at = now()
    FROM public.indents i
    WHERE i.id = NEW.indent_id
      AND i.execution_plan_id IS NOT NULL
      AND so.execution_plan_id = i.execution_plan_id
      AND so.organization_id = NEW.organization_id
      AND so.deleted_at IS NULL
      AND so.status IN ('Planned', 'Pending Consolidation');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_commerce_orders_for_completed_trip() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_fulfill_commerce_orders_on_trip_complete ON public.trips;
CREATE TRIGGER trg_fulfill_commerce_orders_on_trip_complete
AFTER UPDATE OF status ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.fulfill_commerce_orders_for_completed_trip();

UPDATE public.sales_orders so
SET status = 'Fulfilled', updated_at = now()
FROM public.indents i
JOIN public.trips t
  ON t.indent_id = i.id
 AND t.deleted_at IS NULL
 AND lower(t.status) = 'completed'
WHERE i.execution_plan_id IS NOT NULL
  AND so.execution_plan_id = i.execution_plan_id
  AND so.organization_id = t.organization_id
  AND so.deleted_at IS NULL
  AND so.status IN ('Planned', 'Pending Consolidation');
