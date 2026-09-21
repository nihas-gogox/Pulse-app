-- Hard-Copy POD Receipt unification — Phase 4.
--
-- Per Phase 4 discovery: `record_trip_hard_copy_pod` (20260915162440) and the
-- app-layer `markTripHardCopyPodReceived()` (raw `trips.pod_received_at`
-- update) are two disconnected "hard copy POD received" signals. The wider
-- app (POD reconciliation, Invoicing's POD-required gate, Trips lists, Log
-- Incoming PODs' own pending-trips filter) reads `pod_received_at` — the
-- pre-existing, pervasively-used signal. Only the Compliance settlement
-- derivation reads the courier/AWB/received-by columns this RPC used to be
-- the only writer of. This migration makes the RPC the ONE authoritative
-- write path for BOTH: it now also stamps `pod_received_at`, and courier/
-- AWB/received-by become optional supplementary metadata rather than the
-- primary signal. No new column — `pod_received_at` (already on `trips`)
-- is the correct, existing idempotency signal once it's actually written
-- here. No new table, no new audit framework: reuses `trip_workflow_events`
-- and its established idempotency_key pattern (20260801180000).
--
-- DROP + CREATE (not CREATE OR REPLACE) because the return type changes
-- from void to boolean — this is the only way Postgres allows that. Same
-- function name/grants preserved; every existing positional-argument caller
-- (p_trip_id, p_courier, p_awb_number, p_received_by) keeps working, with a
-- new optional 5th argument.

drop function if exists public.record_trip_hard_copy_pod(uuid, text, text, text);

create function public.record_trip_hard_copy_pod(
  p_trip_id uuid,
  p_courier text default null,
  p_awb_number text default null,
  p_received_by text default null,
  p_comment text default null
)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_org_id       uuid;
  v_already_recv timestamptz;
  v_courier      text := nullif(trim(coalesce(p_courier, '')), '');
  v_awb          text := nullif(trim(coalesce(p_awb_number, '')), '');
  v_received_by  text := nullif(trim(coalesce(p_received_by, '')), '');
  v_comment      text := nullif(trim(coalesce(p_comment, '')), '');
begin
  select organization_id, pod_received_at
    into v_org_id, v_already_recv
    from public.trips
   where id = p_trip_id
     for update;

  if v_org_id is null then
    raise exception 'trip not found';
  end if;

  if not public.has_member_surface(v_org_id, 'trip_compliance.pod.manage') then
    raise exception 'not authorized to record hard-copy POD for this organization';
  end if;

  if v_already_recv is not null then
    -- Idempotent retry: do not overwrite the timestamp, actor, or metadata,
    -- do not create a duplicate audit/workflow event.
    return false;
  end if;

  update public.trips
     set pod_received_at = now(),
         pod_hard_copy_courier = coalesce(v_courier, pod_hard_copy_courier),
         pod_hard_copy_awb_number = coalesce(v_awb, pod_hard_copy_awb_number),
         pod_hard_copy_received_by = coalesce(v_received_by, pod_hard_copy_received_by)
   where id = p_trip_id;

  begin
    insert into public.trip_workflow_events
      (trip_id, org_id, actor_id, event_type, payload, idempotency_key)
    values
      (p_trip_id, v_org_id, v_uid, 'pod.hard_copy_received',
       jsonb_build_object(
         'courier', v_courier,
         'awb_number', v_awb,
         'received_by', v_received_by,
         'comment', v_comment
       ),
       p_trip_id::text || ':pod.hard_copy_received');
  exception when unique_violation then
    -- Concurrent caller already recorded this transition; our own UPDATE
    -- above already no-op'd via the row lock + v_already_recv check in that
    -- case, so this branch is belt-and-suspenders, not the primary guard.
    null;
  end;

  return true;
end;
$$;

grant execute on function public.record_trip_hard_copy_pod(uuid, text, text, text, text) to authenticated;
revoke all on function public.record_trip_hard_copy_pod(uuid, text, text, text, text) from public;
