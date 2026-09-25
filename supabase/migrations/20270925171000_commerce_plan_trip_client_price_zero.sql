-- Commerce execution-plan indents store the goods total on indents.client_price
-- as a commercial reference. Both trip-creation RPCs copy that value onto the
-- shipper trip, so Finance treats product value as freight the moment the trip
-- exists. Self-distribution freight stays 0. Product revenue is recognized from
-- the sales orders after the fulfillment trip is completed.
--
-- Mover asset trips use source_indent_id and leave indent_id null, so their
-- receivable (the fulfillment rate) is unchanged.

CREATE OR REPLACE FUNCTION public.trips_apply_sale_rate_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_indent public.indents%ROWTYPE;
BEGIN
  IF NEW.indent_id IS NOT NULL THEN
    SELECT * INTO v_indent FROM public.indents WHERE id = NEW.indent_id;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.indent_id IS NOT NULL AND v_indent.id IS NOT NULL THEN
    NEW.client_id := COALESCE(NEW.client_id, v_indent.client_id);
    NEW.lane_id := COALESCE(NEW.lane_id, v_indent.lane_id);
    NEW.sale_rate_basis := COALESCE(NEW.sale_rate_basis, v_indent.sale_rate_basis);
    NEW.sale_unit_rate := COALESCE(NEW.sale_unit_rate, v_indent.sale_unit_rate);
    IF NEW.load_tons IS NULL AND COALESCE(v_indent.weight, 0) > 0 THEN
      NEW.load_tons := ROUND((v_indent.weight / 1000.0)::numeric, 3);
    END IF;
  END IF;

  IF NEW.sale_rate_basis = 'per_mt'
     AND COALESCE(NEW.sale_unit_rate, 0) > 0
     AND COALESCE(NEW.load_tons, 0) > 0
     AND (
       TG_OP = 'INSERT'
       OR OLD.load_tons IS DISTINCT FROM NEW.load_tons
       OR OLD.sale_unit_rate IS DISTINCT FROM NEW.sale_unit_rate
       OR OLD.sale_rate_basis IS DISTINCT FROM NEW.sale_rate_basis
     )
  THEN
    NEW.client_price := ROUND(NEW.sale_unit_rate * NEW.load_tons, 2);
  END IF;

  IF NEW.indent_id IS NOT NULL AND v_indent.execution_plan_id IS NOT NULL THEN
    NEW.client_price := 0;
  END IF;

  RETURN NEW;
END;
$$;
