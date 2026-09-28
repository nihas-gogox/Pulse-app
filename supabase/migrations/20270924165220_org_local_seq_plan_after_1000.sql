-- Sequence plan after 999 (indent + trip local numbers).
--
-- Band        Local label     Operational code tail
-- 1–999       IND001          SAT812-IND-001
-- 1000–999999 IND001000       SAT812-IND-001000  (6 digits, no wrap)
-- 1_000_000+  IND1000000      full integer, never modulo
--
-- Crossing 1000 / 10000 / 100000 / 1000000 is logged once per org+entity.

CREATE TABLE IF NOT EXISTS public.operational_sequence_rollover_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  milestone bigint NOT NULL,
  sequence_value bigint NOT NULL,
  local_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity_type, milestone)
);

ALTER TABLE public.operational_sequence_rollover_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_sequence_rollover_log FROM PUBLIC;
GRANT SELECT ON TABLE public.operational_sequence_rollover_log TO authenticated;

CREATE POLICY operational_sequence_rollover_log_select_member
  ON public.operational_sequence_rollover_log
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.format_org_local_seq_label(
  p_prefix text,
  p_seq bigint
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_seq IS NULL OR p_seq < 1 THEN p_prefix || '001'
    WHEN p_seq < 1000 THEN p_prefix || lpad(p_seq::text, 3, '0')
    WHEN p_seq < 1000000 THEN p_prefix || lpad(p_seq::text, 6, '0')
    ELSE p_prefix || p_seq::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.log_operational_sequence_milestone(
  p_org_id uuid,
  p_entity_type text,
  p_seq bigint,
  p_local_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_milestone bigint;
BEGIN
  IF p_seq IS NULL OR p_seq < 1000 THEN
    RETURN;
  END IF;

  v_milestone := CASE
    WHEN p_seq >= 1000000 THEN 1000000
    WHEN p_seq >= 100000 THEN 100000
    WHEN p_seq >= 10000 THEN 10000
    ELSE 1000
  END;

  INSERT INTO public.operational_sequence_rollover_log (
    organization_id, entity_type, milestone, sequence_value, local_number
  )
  VALUES (p_org_id, p_entity_type, v_milestone, p_seq, p_local_number)
  ON CONFLICT (organization_id, entity_type, milestone) DO NOTHING;

  IF FOUND THEN
    RAISE LOG 'operational_sequence_rollover org=% entity=% milestone=% seq=% label=%',
      p_org_id, p_entity_type, v_milestone, p_seq, p_local_number;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_operational_code(
  org_id uuid,
  entity_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_code text;
  v_entity text := lower(trim(entity_type));
  v_seq bigint;
  v_prefix text;
  v_width int;
BEGIN
  v_org_code := public.ensure_organization_operational_code(org_id);
  v_prefix := public.operational_prefix_for_entity(v_entity);
  v_seq := public.next_operational_sequence_value(org_id, v_entity);
  v_width := CASE
    WHEN v_seq < 1000 THEN 3
    WHEN v_seq < 1000000 THEN 6
    ELSE length(v_seq::text)
  END;

  RETURN upper(v_org_code) || '-' || v_prefix || '-' || lpad(v_seq::text, v_width, '0');
END;
$$;

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
    v_candidate := public.format_org_local_seq_label('IND', v_seq);

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

  PERFORM public.log_operational_sequence_milestone(
    NEW.organization_id, 'indent', v_seq, NEW.indent_number
  );

  RETURN NEW;
END;
$function$;
