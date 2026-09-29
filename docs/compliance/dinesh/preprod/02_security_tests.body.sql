-- Security acceptance 1–12 (body). Built into 02_security_tests.sql by build.sh.
-- One transaction, ROLLED BACK. Each check is its own statement so later
-- statements see earlier writes.

-- 5. anon
select pg_temp.rec('05', 'anon cannot execute decline', 'ERR[42501] permission denied', x, x like 'ERR[42501]: permission denied%')
  from (select pg_temp.call_as(null, pg_temp.decline_sql('Valid reason', 'k-anon')) x) s;
-- 2. member without the surface
select pg_temp.rec('02', 'member without trip.mark_verified rejected', 'ERR not authorized', x, x like 'ERR[%]: not authorized%')
  from (select pg_temp.call_as(pg_temp.fx('u_nogrant'), pg_temp.decline_sql('Valid reason', 'k-ng')) x) s;
-- 3. other org
select pg_temp.rec('03', 'member of another org rejected', 'ERR not authorized', x, x like 'ERR[%]: not authorized%')
  from (select pg_temp.call_as(pg_temp.fx('u_other'), pg_temp.decline_sql('Valid reason', 'k-oth')) x) s;
-- 4. inactive
select pg_temp.rec('04', 'inactive member rejected', 'ERR not authorized', x, x like 'ERR[%]: not authorized%')
  from (select pg_temp.call_as(pg_temp.fx('u_inactive'), pg_temp.decline_sql('Valid reason', 'k-in')) x) s;
select pg_temp.rec('02-05', 'rejected calls wrote nothing', 'events=0, declined_at null',
  format('events=%s declined_at=%s', pg_temp.events(), (pg_temp.trip()).compliance_declined_at),
  pg_temp.events() = 0 and (pg_temp.trip()).compliance_declined_at is null);

-- 7/8/9. invalid reasons (authorized caller)
select pg_temp.rec('07', 'whitespace-only reason (\n\t spaces) rejected', 'ERR reason', x, x like 'ERR[%]: a decline reason%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql(E' \n\t \r\n ', 'k-ws')) x) s;
select pg_temp.rec('08', '2 chars ("  ab  " trimmed) rejected', 'ERR reason', x, x like 'ERR[%]: a decline reason%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('  ab  ', 'k-2')) x) s;
select pg_temp.rec('08', 'null reason rejected', 'ERR reason', x, x like 'ERR[%]: a decline reason%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), format('select public.decline_trip_compliance(%L::uuid, null, null)', pg_temp.fx('trip'))) x) s;
select pg_temp.rec('09', '501 chars rejected', 'ERR reason', x, x like 'ERR[%]: a decline reason%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql(repeat('x', 501), 'k-501')) x) s;
select pg_temp.rec('07-09', 'invalid reasons wrote nothing', 'events=0', 'events=' || pg_temp.events(), pg_temp.events() = 0);

-- 10 + 1. valid 3 and 500 chars accepted (authorized member, then admin shortcut)
select pg_temp.rec('10', '3 chars "abc" accepted (u_ok)', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('abc', 'k-3')) x) s;
select pg_temp.rec('01', 'authorized decline persisted: by=u_ok, reason, time, still unverified', 'by=u_ok reason=abc',
  format('by_ok=%s reason=%L declined_at_set=%s verified_at=%s',
         (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_ok'), (pg_temp.trip()).compliance_decline_reason,
         (pg_temp.trip()).compliance_declined_at is not null, (pg_temp.trip()).compliance_verified_at),
  (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_ok') and (pg_temp.trip()).compliance_decline_reason = 'abc'
    and (pg_temp.trip()).compliance_declined_at is not null and (pg_temp.trip()).compliance_verified_at is null);
select pg_temp.rec('10', '500 chars accepted (org admin via role shortcut)', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_admin'), pg_temp.decline_sql(repeat('y', 500), 'k-500')) x) s;
select pg_temp.rec('10', '500-char reason stored, by=u_admin', 'len=500 by_admin',
  format('len=%s by_admin=%s', char_length((pg_temp.trip()).compliance_decline_reason), (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_admin')),
  char_length((pg_temp.trip()).compliance_decline_reason) = 500 and (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_admin'));

-- 11. duplicate idempotency key
select pg_temp.rec('11', 'events before replay', 'events=2', 'events=' || pg_temp.events(), pg_temp.events() = 2);
select pg_temp.rec('11', 'replay key k-500 with a different reason returns OK', 'OK (no-op)', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_admin'), pg_temp.decline_sql('Replay must be ignored', 'k-500')) x) s;
select pg_temp.rec('11', 'replay: no new event, reason not overwritten', 'events=2 len=500',
  format('events=%s len=%s', pg_temp.events(), char_length((pg_temp.trip()).compliance_decline_reason)),
  pg_temp.events() = 2 and (pg_temp.trip()).compliance_decline_reason = repeat('y', 500));
select pg_temp.rec('11', 'event keys are unique per submit', 'k-3,k-500',
  (select string_agg(replace(idempotency_key, pg_temp.fx('trip')::text || ':compliance.declined:', ''), ',' order by created_at, idempotency_key)
     from public.trip_workflow_events where trip_id = pg_temp.fx('trip') and event_type = 'compliance.declined'),
  (select count(distinct idempotency_key) from public.trip_workflow_events
    where trip_id = pg_temp.fx('trip') and event_type = 'compliance.declined') = 2);

-- 6. direct updates of decline columns via the API roles
select pg_temp.rec('06', 'direct UPDATE decline_reason by authorized member rejected by guard', 'ERR[42501] guard', x, x like 'ERR[42501]: compliance decline fields%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'),
          format('update public.trips set compliance_decline_reason = %L where id = %L', 'Forged direct write', pg_temp.fx('trip'))) x) s;
select pg_temp.rec('06', 'direct UPDATE clearing declined_at by member without grant rejected', 'ERR[42501] guard', x, x like 'ERR[42501]: compliance decline fields%')
  from (select pg_temp.call_as(pg_temp.fx('u_nogrant'),
          format('update public.trips set compliance_declined_at = null where id = %L', pg_temp.fx('trip'))) x) s;
select pg_temp.rec('06', 'direct UPDATE spoofing declined_by rejected', 'ERR[42501] guard', x, x like 'ERR[42501]: compliance decline fields%')
  from (select pg_temp.call_as(pg_temp.fx('u_nogrant'),
          format('update public.trips set compliance_declined_by = %L where id = %L', pg_temp.fx('u_nogrant'), pg_temp.fx('trip'))) x) s;
select pg_temp.rec('06', 'unrelated column update by member still works (guard is column-scoped)', 'OK rows=1', x, x like 'OK rows=1')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'),
          format('update public.trips set updated_at = updated_at where id = %L', pg_temp.fx('trip'))) x) s;
select pg_temp.rec('06', 'decline state unchanged after direct-write attempts', 'len=500 by_admin',
  format('len=%s by_admin=%s', char_length((pg_temp.trip()).compliance_decline_reason), (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_admin')),
  (pg_temp.trip()).compliance_decline_reason = repeat('y', 500) and (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_admin'));

-- 12. user deletion is not blocked by compliance_declined_by (isolated: u_nodel has no events)
update public.trips set compliance_declined_by = pg_temp.fx('u_nodel') where id = pg_temp.fx('trip'); -- as postgres (owner) → guard allows
do $$
begin
  begin
    delete from auth.users where id = pg_temp.fx('u_nodel');
    perform pg_temp.rec('12', 'delete auth user referenced only by compliance_declined_by succeeds', 'OK', 'OK', true);
  exception when others then
    perform pg_temp.rec('12', 'delete auth user referenced only by compliance_declined_by succeeds', 'OK', 'ERR[' || sqlstate || ']: ' || sqlerrm, false);
  end;
end $$;
select pg_temp.rec('12', 'FK set compliance_declined_by to NULL', 'null', coalesce((pg_temp.trip()).compliance_declined_by::text, 'null'),
  (pg_temp.trip()).compliance_declined_by is null);
-- Informational: a user WITH decline events is still blocked by the PRE-EXISTING
-- trip_workflow_events_actor_id_fkey (no ON DELETE) — true for every event type on V1.
do $$
begin
  begin
    delete from auth.users where id = pg_temp.fx('u_ok');
    perform pg_temp.rec('12-info', 'PRE-EXISTING: delete user who has workflow events', 'informational', 'OK (not blocked)', null);
  exception when others then
    perform pg_temp.rec('12-info', 'PRE-EXISTING: delete user who has workflow events', 'informational', 'ERR[' || sqlstate || ']: ' || sqlerrm, null);
  end;
end $$;

-- Verified trip → decline rejected (server rule)
update public.trip_documents set status = 'verified'
 where trip_id = pg_temp.fx('trip') and document_type in ('lr', 'invoice', 'eway_bill');
select pg_temp.rec('extra', 'verify succeeds for authorized member (setup for next check)', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.verify_sql()) x) s;
select pg_temp.rec('extra', 'decline on already-verified trip rejected', 'ERR already verified', x, x like 'ERR[%]: trip compliance already verified%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('Too late', 'k-late')) x) s;

select step, case when pass is null then 'INFO' when pass then 'PASS' else 'FAIL' end as result,
       name, expected, left(actual, 130) as actual
  from r order by step, name;
rollback;
