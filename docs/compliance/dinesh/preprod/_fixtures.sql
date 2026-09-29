-- Shared fixture block for 02_security_tests.sql / 03_lifecycle.sql.
-- NOT run on its own: build.sh concatenates it after `begin;` and before the
-- tests, and the tests end with `rollback;` — nothing here ever persists.
--
-- Synthetic identities (never real users): emails end in @example.invalid.
--   u_ok       member of the trip's org WITH trip_compliance.trip.mark_verified
--   u_nogrant  member of the trip's org without the surface
--   u_other    member of ANOTHER org with the surface
--   u_inactive member of the trip's org, surface granted, status inactive
--   u_admin    admin of the trip's org (role shortcut, no explicit surface)
--   u_nodel    user with no events; used to prove the declined_by FK doesn't block deletion

create temp table r (step text, name text, expected text, actual text, pass boolean) on commit drop;
create temp table fx (k text primary key, v uuid) on commit drop;

create function pg_temp.call_as(p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare v_rows int;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  begin
    if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
    execute p_sql;
    get diagnostics v_rows = row_count;
    execute 'reset role';
    return 'OK rows=' || v_rows;
  exception when others then
    return 'ERR[' || sqlstate || ']: ' || sqlerrm;
  end;
end $f$;

create function pg_temp.rec(p_step text, p_name text, p_expected text, p_actual text, p_pass boolean)
returns void language sql as $f$ insert into r values (p_step, p_name, p_expected, p_actual, p_pass) $f$;

do $$
declare v_trip uuid; v_org uuid; v_org2 uuid;
begin
  -- Unverified, undeclined trip that has all three required trip document types.
  select t.id, t.organization_id into v_trip, v_org
    from public.trips t
   where t.compliance_verified_at is null
     and t.compliance_declined_at is null
     and (select count(distinct d.document_type) from public.trip_documents d
           where d.trip_id = t.id and d.document_type in ('lr', 'invoice', 'eway_bill')) = 3
   order by t.created_at desc limit 1;
  if v_trip is null then raise exception 'FIXTURE: no unverified trip with lr/invoice/eway_bill docs'; end if;
  select id into v_org2 from public.organizations where id <> v_org order by created_at desc limit 1;
  insert into fx values ('trip', v_trip), ('org', v_org), ('org2', v_org2),
    ('u_ok', gen_random_uuid()), ('u_nogrant', gen_random_uuid()), ('u_other', gen_random_uuid()),
    ('u_inactive', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_nodel', gen_random_uuid());
  insert into auth.users (id, aud, role, email)
    select v, 'authenticated', 'authenticated', 'claude-qa-' || k || '-' || left(v::text, 8) || '@example.invalid'
      from fx where k like 'u\_%';
  insert into public.organization_members (organization_id, user_id, role, status, permissions) values
    (v_org,  (select v from fx where k = 'u_ok'),       'member', 'active',   '{"surfaces":{"trip_compliance.trip.mark_verified":true}}'),
    (v_org,  (select v from fx where k = 'u_nogrant'),  'member', 'active',   '{}'),
    (v_org2, (select v from fx where k = 'u_other'),    'member', 'active',   '{"surfaces":{"trip_compliance.trip.mark_verified":true}}'),
    (v_org,  (select v from fx where k = 'u_inactive'), 'member', 'inactive', '{"surfaces":{"trip_compliance.trip.mark_verified":true}}'),
    (v_org,  (select v from fx where k = 'u_admin'),    'admin',  'active',   '{}');
end $$;

create function pg_temp.fx(p text) returns uuid language sql as $f$ select v from fx where k = p $f$;
create function pg_temp.decline_sql(p_reason text, p_key text) returns text language sql as $f$
  select format('select public.decline_trip_compliance(%L::uuid, %L, %L)', pg_temp.fx('trip'), p_reason, p_key) $f$;
create function pg_temp.verify_sql() returns text language sql as $f$
  select format('select public.mark_trip_compliance_verified(%L::uuid)', pg_temp.fx('trip')) $f$;
create function pg_temp.events() returns int language sql as $f$
  select count(*)::int from public.trip_workflow_events
   where trip_id = pg_temp.fx('trip') and event_type = 'compliance.declined' $f$;
create function pg_temp.trip() returns public.trips language sql as $f$
  select * from public.trips where id = pg_temp.fx('trip') $f$;
