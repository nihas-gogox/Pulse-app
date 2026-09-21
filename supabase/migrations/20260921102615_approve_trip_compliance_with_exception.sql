-- Compliance "Approve with Exception" — Phase 2 of the Compliance / Advance /
-- Hard-Copy POD / Balance / Settlement workflow.
--
-- Per the Phase 1 discovery, the settlement-stage model (ComplianceStage,
-- deriveComplianceStage()) already exists and is NOT touched here. What's
-- missing is a way to distinguish *how* a trip reached compliance_verified:
-- normal approval (all required docs verified) vs. an explicit, audited
-- exception (approved despite missing/pending/rejected required docs).
--
-- Persistence: extends `trips` with 3 columns rather than a new table.
-- `compliance_verified_by`/`compliance_verified_at` (added in 20260915162440)
-- are reused as the decision actor/timestamp for BOTH decision types — no
-- redundant compliance_decision_at/compliance_decision_by columns.
--
-- Audit: reuses `trip_workflow_events` (added 20260801170000) + its existing
-- idempotency_key partial-unique-index pattern (20260801180000) for
-- retry-safety, exactly like 'trip.completed'/'pod.uploaded' etc. No new
-- audit framework.

-- ── 1. Decision columns on trips ────────────────────────────────────────────

alter table public.trips
  add column if not exists compliance_decision text
    check (compliance_decision in ('approved', 'approved_with_exception')),
  add column if not exists compliance_exception_reason text,
  add column if not exists compliance_outstanding_summary jsonb;

comment on column public.trips.compliance_decision is
  'How compliance_verified_at/by was reached: approved (all required docs verified) or approved_with_exception (see compliance_exception_reason / compliance_outstanding_summary). Null until a decision is made. Distinct from ComplianceStage (TS-derived, never persisted) — this only disambiguates the approval path.';
comment on column public.trips.compliance_exception_reason is
  'Mandatory comment captured by approve_trip_compliance_with_exception(). Null for normal approvals.';
comment on column public.trips.compliance_outstanding_summary is
  'Snapshot at decision time: {"missing": [...], "pending_verification": [...], "rejected": [...]} among the required trip document types. Null for normal approvals (nothing was outstanding).';

-- ── 2. mark_trip_compliance_verified — unchanged gate, now also stamps the
--    decision as 'approved' and clears any earlier exception markers (a trip
--    that becomes fully compliant later is no longer "under exception").
-- ── Required-type list, has_member_surface grant, and verified-status
--    condition are UNCHANGED from 20270920140000 — no regression.

create or replace function public.mark_trip_compliance_verified(p_trip_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_org_id  uuid;
  v_missing text;
  v_required text[] := array['lr', 'invoice', 'eway_bill'];
begin
  select organization_id into v_org_id from public.trips where id = p_trip_id;
  if v_org_id is null then
    raise exception 'trip not found';
  end if;
  if not public.has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified') then
    raise exception 'not authorized to mark compliance verified for this organization';
  end if;

  select string_agg(rt, ', ') into v_missing
    from unnest(v_required) rt
   where not exists (
     select 1 from public.trip_documents td
      where td.trip_id = p_trip_id
        and td.document_type = rt
        and td.status = 'verified'
   );

  if v_missing is not null then
    raise exception 'required documents not yet verified: %', v_missing;
  end if;

  update public.trips
     set compliance_verified_by = v_uid,
         compliance_verified_at = now(),
         compliance_decision = 'approved',
         compliance_exception_reason = null,
         compliance_outstanding_summary = null
   where id = p_trip_id;
end;
$$;

-- ── 3. approve_trip_compliance_with_exception ───────────────────────────────
--
-- Same SECURITY DEFINER + has_member_surface() pattern as every other
-- compliance RPC. Reuses the 'trip_compliance.trip.mark_verified' surface —
-- the same actors who can normally mark compliance verified can also grant
-- an exception; this is a variant of the same action, not a new capability,
-- so no new permission grant/registry entry is introduced.
--
-- Idempotency/concurrency:
--   - `select ... for update` on the trips row serializes concurrent callers.
--   - Already approved_with_exception -> no-op (safe retry).
--   - Already approved (normal) -> hard error (no APPROVED -> EXCEPTION
--     downgrade), per explicit instruction.
--   - The trip_workflow_events insert is guarded by the row lock above, and
--     additionally by the idempotency_key unique index as a second layer —
--     a unique_violation on that insert is swallowed (already-recorded).

create or replace function public.approve_trip_compliance_with_exception(
  p_trip_id uuid,
  p_comment text
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_org_id      uuid;
  v_decision    text;
  v_verified_at timestamptz;
  v_comment     text := trim(p_comment);
  v_required    text[] := array['lr', 'invoice', 'eway_bill'];
  v_missing     text[] := array[]::text[];
  v_pending     text[] := array[]::text[];
  v_rejected    text[] := array[]::text[];
  v_outstanding jsonb;
  v_status      text;
  rt            text;
begin
  if coalesce(v_comment, '') = '' then
    raise exception 'a comment is required to approve compliance with an exception';
  end if;

  select organization_id, compliance_decision, compliance_verified_at
    into v_org_id, v_decision, v_verified_at
    from public.trips
   where id = p_trip_id
     for update;

  if v_org_id is null then
    raise exception 'trip not found';
  end if;

  if not public.has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified') then
    raise exception 'not authorized to approve compliance for this organization';
  end if;

  if v_verified_at is not null and v_decision = 'approved' then
    raise exception 'trip compliance was already approved normally; cannot downgrade to an exception approval';
  end if;

  if v_verified_at is not null and v_decision = 'approved_with_exception' then
    -- Idempotent retry of the same exception decision.
    return;
  end if;

  foreach rt in array v_required loop
    v_status := null;
    select td.status into v_status
      from public.trip_documents td
     where td.trip_id = p_trip_id
       and td.document_type = rt
     order by case td.status when 'verified' then 0 when 'pending' then 1 when 'rejected' then 2 else 3 end
     limit 1;

    if v_status is null then
      v_missing := array_append(v_missing, rt);
    elsif v_status = 'pending' then
      v_pending := array_append(v_pending, rt);
    elsif v_status = 'rejected' then
      v_rejected := array_append(v_rejected, rt);
    end if;
    -- 'verified' -> satisfied, not outstanding.
  end loop;

  if array_length(v_missing, 1) is null and array_length(v_pending, 1) is null and array_length(v_rejected, 1) is null then
    raise exception 'all required documents are already verified; use mark_trip_compliance_verified instead';
  end if;

  v_outstanding := jsonb_build_object(
    'missing', to_jsonb(v_missing),
    'pending_verification', to_jsonb(v_pending),
    'rejected', to_jsonb(v_rejected)
  );

  update public.trips
     set compliance_verified_by = v_uid,
         compliance_verified_at = now(),
         compliance_decision = 'approved_with_exception',
         compliance_exception_reason = v_comment,
         compliance_outstanding_summary = v_outstanding
   where id = p_trip_id;

  begin
    insert into public.trip_workflow_events
      (trip_id, org_id, actor_id, event_type, payload, idempotency_key)
    values
      (p_trip_id, v_org_id, v_uid, 'compliance.approved_with_exception',
       jsonb_build_object(
         'comment', v_comment,
         'outstanding', v_outstanding,
         'previous_decision', v_decision
       ),
       p_trip_id::text || ':compliance.approved_with_exception');
  exception when unique_violation then
    null;
  end;
end;
$$;

grant execute on function public.approve_trip_compliance_with_exception(uuid, text) to authenticated;
revoke all on function public.approve_trip_compliance_with_exception(uuid, text) from public;
