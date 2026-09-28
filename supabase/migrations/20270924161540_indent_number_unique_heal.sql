-- Fix: indent create fails with
--   duplicate key value violates unique constraint
--   "indents_organization_id_indent_number_key"
--
-- Cause: organization_counters.indent_seq lagged at 0 while the org already
-- had IND001–IND999. A leftover/legacy allocator reissued IND001.
-- Also: 3-digit IND + seq>=1000 can wrap to a used number if only the last
-- three digits are kept.
--
-- Fix: allocate a unique per-org indent_number (IND1000+ after 999),
-- drop the legacy trigger if both fire, and heal lagged counters.

DROP TRIGGER IF EXISTS set_indent_number_trigger ON public.indents;

CREATE OR REPLACE FUNCTION public.set_indent_operational_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seq_text text;
  v_seq bigint;
  v_max_existing bigint;
  v_candidate text;
  v_tries int := 0;
  v_taken boolean;
BEGIN
  IF NEW.indent_code IS NULL OR btrim(NEW.indent_code) = '' THEN
    NEW.indent_code := public.generate_operational_code(NEW.organization_id, 'indent');
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN i.indent_number ~ '^IND[0-9]+$'
      THEN substring(i.indent_number FROM '[0-9]+$')::bigint
      ELSE 0
    END
  ), 0)
  INTO v_max_existing
  FROM public.indents i
  WHERE i.organization_id = NEW.organization_id;

  v_seq_text := substring(COALESCE(NEW.indent_code, '') FROM '([0-9]+)$');
  v_seq := CASE
    WHEN v_seq_text IS NULL OR btrim(v_seq_text) = '' THEN 0
    ELSE v_seq_text::bigint
  END;
  v_seq := GREATEST(v_seq, v_max_existing + 1);

  LOOP
    IF v_seq < 1000 THEN
      v_candidate := 'IND' || lpad(v_seq::text, 3, '0');
    ELSE
      v_candidate := 'IND' || v_seq::text;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.indents i
      WHERE i.organization_id = NEW.organization_id
        AND i.indent_number = v_candidate
    ) INTO v_taken;

    EXIT WHEN NOT v_taken;

    v_seq := v_seq + 1;
    v_tries := v_tries + 1;
    IF v_tries > 80 THEN
      v_candidate := public.get_safe_fallback_indent_number();
      EXIT;
    END IF;
  END LOOP;

  IF NEW.indent_number IS NULL
     OR btrim(NEW.indent_number) = ''
     OR EXISTS (
       SELECT 1
       FROM public.indents i
       WHERE i.organization_id = NEW.organization_id
         AND i.indent_number = NEW.indent_number
     )
  THEN
    NEW.indent_number := v_candidate;
  END IF;

  IF NEW.display_indent_id IS NULL OR btrim(NEW.display_indent_id) = '' THEN
    NEW.display_indent_id := NEW.indent_number;
  END IF;

  IF NEW.sequence_number IS NULL THEN
    NEW.sequence_number := v_seq;
  END IF;

  INSERT INTO public.organization_counters (organization_id, indent_seq)
  VALUES (NEW.organization_id, v_seq)
  ON CONFLICT (organization_id) DO UPDATE
    SET indent_seq = GREATEST(public.organization_counters.indent_seq, EXCLUDED.indent_seq);

  INSERT INTO public.operational_sequences (organization_id, entity_type, current_value)
  VALUES (NEW.organization_id, 'indent', v_seq)
  ON CONFLICT (organization_id, entity_type) DO UPDATE
    SET current_value = GREATEST(public.operational_sequences.current_value, EXCLUDED.current_value),
        updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_indent_number ON public.indents;
CREATE TRIGGER trg_set_indent_number
  BEFORE INSERT ON public.indents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_indent_operational_identity();

-- Heal lagged counters so the next share starts after the highest used IND.
UPDATE public.organization_counters oc
SET indent_seq = src.max_seq
FROM (
  SELECT organization_id,
    COALESCE(MAX(
      CASE
        WHEN indent_number ~ '^IND[0-9]+$'
        THEN substring(indent_number FROM '[0-9]+$')::bigint
        ELSE 0
      END
    ), 0) AS max_seq
  FROM public.indents
  GROUP BY organization_id
) src
WHERE oc.organization_id = src.organization_id
  AND oc.indent_seq < src.max_seq;

UPDATE public.operational_sequences os
SET current_value = src.max_seq,
    updated_at = now()
FROM (
  SELECT organization_id,
    COALESCE(MAX(
      CASE
        WHEN indent_number ~ '^IND[0-9]+$'
        THEN substring(indent_number FROM '[0-9]+$')::bigint
        ELSE 0
      END
    ), 0) AS max_seq
  FROM public.indents
  GROUP BY organization_id
) src
WHERE os.organization_id = src.organization_id
  AND os.entity_type = 'indent'
  AND os.current_value < src.max_seq;
