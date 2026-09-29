-- Compliance "Decline" — Dinesh sir's Compliance Table change request
-- (docs/compliance/dinesh/CONTRACT.md §2.D).
--
-- Why: reviewers need a way to send a trip back with a reason instead of only
-- Verify / Approve-with-exception. A decline does NOT move the trip out of
-- Compliance Pending; it records who declined, when, and why so the table,
-- cards and details screen can show a "Declined" pill + reason.
--
-- What:
--   1. Three nullable columns on public.trips (no backfill, existing rows
--      stay null = "never declined").
--   2. Named check constraint on the reason length (3–500 chars, trimmed by
--      the RPC before write).
--   3. RPC public.decline_trip_compliance(p_trip_id, p_reason,
--      p_idempotency_key) — SECURITY DEFINER, same has_member_surface()
--      surface as mark_trip_compliance_verified, audited in
--      trip_workflow_events as 'compliance.declined'.
--
-- Intentionally unchanged: mark_trip_compliance_verified and
-- approve_trip_compliance_with_exception. A declined-then-verified trip keeps
-- its decline columns as history; the client treats a decline as active only
-- while compliance_verified_at is null.
--
-- Timestamp note: 20270929… (not `supabase migration new`) because the remote
-- head is future-dated 20270928114500; non-000000 so it can never collide with
-- pulse-unified-base's midnight stamps.

-- Fail fast instead of queueing behind long trips/auth.users locks.
set local lock_timeout = '5s';

-- ── 1. Decline columns on trips ─────────────────────────────────────────────

alter table public.trips
  add column if not exists compliance_declined_at timestamptz,
  add column if not exists compliance_declined_by uuid references auth.users(id) on delete set null,
  add column if not exists compliance_decline_reason text;

alter table public.trips
  drop constraint if exists trips_compliance_decline_reason_length_check;
alter table public.trips
  add constraint trips_compliance_decline_reason_length_check
    check (
      compliance_decline_reason is null
      or char_length(compliance_decline_reason) between 3 and 500
    ) not valid;
-- Validate separately: SHARE UPDATE EXCLUSIVE instead of holding
-- ACCESS EXCLUSIVE on trips for the scan (all existing rows are null).
alter table public.trips
  validate constraint trips_compliance_decline_reason_length_check;

comment on column public.trips.compliance_declined_at is
  'When the latest compliance decline was recorded by decline_trip_compliance(). Null if never declined. Active only while compliance_verified_at is null; kept as history afterwards.';
comment on column public.trips.compliance_declined_by is
  'auth.users id of the reviewer who recorded the latest compliance decline.';
comment on column public.trips.compliance_decline_reason is
  'Trimmed reason (3–500 chars) for the latest compliance decline. Earlier reasons live in trip_workflow_events (event_type = compliance.declined).';

-- ── 2. decline_trip_compliance ──────────────────────────────────────────────
--
-- Same SECURITY DEFINER + has_member_surface() pattern as the other compliance
-- RPCs; reuses 'trip_compliance.trip.mark_verified' (the actors who decide
-- approval also decide decline — no new permission).
--
-- Concurrency / idempotency:
--   - `select ... for update` serializes concurrent callers on the trip row.
--   - Already verified -> hard error (nothing to decline).
--   - Decline after decline is allowed: replaces the current reason; history
--     is kept in trip_workflow_events.
--   - With p_idempotency_key: the event row is inserted FIRST with key
--     trip_id || ':compliance.declined:' || key. A unique_violation means this
--     exact submit was already applied -> return without touching the trip
--     (no second event, no overwrite).
--   - Without a key: always records a new event (no key) and updates.

create or replace function public.decline_trip_compliance(
  p_trip_id uuid,
  p_reason text,
  p_idempotency_key text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_org_id          uuid;
  v_verified_at     timestamptz;
  v_previous_reason text;
  -- Strip all leading/trailing whitespace (SQL trim() only strips spaces).
  v_reason          text := regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g');
  v_key             text := nullif(trim(p_idempotency_key), '');
  v_payload         jsonb;
begin
  -- Authorize before locking: callers without the grant can neither lock the
  -- row nor distinguish "missing" from "not yours".
  select organization_id into v_org_id from public.trips where id = p_trip_id;

  if v_org_id is null
     or not public.has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified') then
    raise exception 'not authorized to decline compliance for this trip';
  end if;

  select compliance_verified_at, compliance_decline_reason
    into v_verified_at, v_previous_reason
    from public.trips
   where id = p_trip_id
     and organization_id = v_org_id
     for update;

  -- Trip moved to another org between the check and the lock.
  if not found then
    raise exception 'not authorized to decline compliance for this trip';
  end if;

  if v_verified_at is not null then
    raise exception 'trip compliance already verified; cannot decline';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'a decline reason between 3 and 500 characters is required';
  end if;

  v_payload := jsonb_build_object(
    'reason', v_reason,
    'previous_reason', v_previous_reason
  );

  if v_key is not null then
    begin
      insert into public.trip_workflow_events
        (trip_id, org_id, actor_id, event_type, payload, idempotency_key)
      values
        (p_trip_id, v_org_id, v_uid, 'compliance.declined', v_payload,
         p_trip_id::text || ':compliance.declined:' || v_key);
    exception when unique_violation then
      -- Duplicate submit of the same decline: already applied.
      return;
    end;
  else
    insert into public.trip_workflow_events
      (trip_id, org_id, actor_id, event_type, payload)
    values
      (p_trip_id, v_org_id, v_uid, 'compliance.declined', v_payload);
  end if;

  update public.trips
     set compliance_declined_at = now(),
         compliance_declined_by = v_uid,
         compliance_decline_reason = v_reason
   where id = p_trip_id;
end;
$$;

grant execute on function public.decline_trip_compliance(uuid, text, text) to authenticated;
revoke all on function public.decline_trip_compliance(uuid, text, text) from public;
revoke all on function public.decline_trip_compliance(uuid, text, text) from anon;

-- ── 3. Decline columns are RPC-only ─────────────────────────────────────────
-- trips RLS lets org staff, supplier-org members and assigned drivers UPDATE
-- any trips column (pre-existing, also true for compliance_verified_*). Block
-- direct API writes to the three NEW columns so decline state can only come
-- from decline_trip_compliance(), which runs as its owner, not as
-- authenticated/anon. The pre-existing compliance_verified_* exposure is left
-- unchanged on purpose (see docs/compliance/dinesh/MIGRATION.md).

create or replace function public.guard_trip_compliance_decline_columns()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.compliance_declined_at    is distinct from old.compliance_declined_at
       or new.compliance_declined_by    is distinct from old.compliance_declined_by
       or new.compliance_decline_reason is distinct from old.compliance_decline_reason) then
    raise exception 'compliance decline fields can only be changed via decline_trip_compliance()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_trip_compliance_decline_columns() from public;
revoke all on function public.guard_trip_compliance_decline_columns() from anon;
revoke all on function public.guard_trip_compliance_decline_columns() from authenticated;

drop trigger if exists trg_guard_trip_compliance_decline_columns on public.trips;
create trigger trg_guard_trip_compliance_decline_columns
  before update of compliance_declined_at, compliance_declined_by, compliance_decline_reason
  on public.trips
  for each row execute function public.guard_trip_compliance_decline_columns();
