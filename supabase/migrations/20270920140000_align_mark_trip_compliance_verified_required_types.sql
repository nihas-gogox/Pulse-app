-- Align mark_trip_compliance_verified with REQUIRED_COMPLIANCE_DOCUMENT_TYPES
-- (features/tripCompliance/tripCompliance.types.ts): lr, invoice, eway_bill.
-- Insurance and RC are vehicle-vault types, not trip_documents for this gate.
-- Signature, grants, has_member_surface check, and verified-status condition
-- are unchanged. Only the required-type list is corrected.

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
  -- Kept in sync with REQUIRED_COMPLIANCE_DOCUMENT_TYPES in
  -- features/tripCompliance/tripCompliance.types.ts — server re-derives the
  -- gate rather than trusting the client's own check.
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
         compliance_verified_at = now()
   where id = p_trip_id;
end;
$$;
