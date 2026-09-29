-- Real lifecycle (body). Built into 03_lifecycle.sql by build.sh.
-- Real tables, real RPCs, real RLS/grants; one transaction, ROLLED BACK.
-- Cross-session persistence (refresh / another user) is NOT provable here —
-- that is 04 (committed QA step, needs explicit authorization).

select pg_temp.rec('L01', 'pending: trip unverified and undeclined', 'verified null, declined null',
  format('verified=%s declined=%s', (pg_temp.trip()).compliance_verified_at, (pg_temp.trip()).compliance_declined_at),
  (pg_temp.trip()).compliance_verified_at is null and (pg_temp.trip()).compliance_declined_at is null);

select pg_temp.rec('L02', 'valid decline (padded reason) by authorized member', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql(E'  Invoice amount does not match LR \n', 'k1')) x) s;

select pg_temp.rec('L03', 'persisted: reason trimmed, by=u_ok, time=now(), still unverified', 'reason/by/time set, verified null',
  format('reason=%L by_ok=%s at_is_now=%s verified=%s', (pg_temp.trip()).compliance_decline_reason,
         (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_ok'), (pg_temp.trip()).compliance_declined_at = now(),
         (pg_temp.trip()).compliance_verified_at),
  (pg_temp.trip()).compliance_decline_reason = 'Invoice amount does not match LR'
    and (pg_temp.trip()).compliance_declined_by = pg_temp.fx('u_ok')
    and (pg_temp.trip()).compliance_declined_at = now()
    and (pg_temp.trip()).compliance_verified_at is null);

-- "Refresh/read": the same columns the app reads (fetchComplianceTripFlags), read as the member via RLS.
select pg_temp.rec('L04', 'read-back as authorized member via RLS (app select)', 'OK rows=1', x, x = 'OK rows=1')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'),
          format('select id, compliance_verified_at, compliance_declined_at, compliance_declined_by, compliance_decline_reason from public.trips where id = %L and compliance_decline_reason = %L',
                 pg_temp.fx('trip'), 'Invoice amount does not match LR')) x) s;

select pg_temp.rec('L05', 'audit event 1: actor, key, payload {reason, previous_reason:null}', 'events=1',
  format('events=%s actor_ok=%s payload=%s', pg_temp.events(), e.actor_id = pg_temp.fx('u_ok'), e.payload),
  pg_temp.events() = 1 and e.actor_id = pg_temp.fx('u_ok')
    and e.idempotency_key = pg_temp.fx('trip')::text || ':compliance.declined:k1'
    and e.payload->>'reason' = 'Invoice amount does not match LR' and e.payload->'previous_reason' = 'null'::jsonb)
from public.trip_workflow_events e
where e.trip_id = pg_temp.fx('trip') and e.event_type = 'compliance.declined';

select pg_temp.rec('L06', 'second decline (new key) replaces current reason', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('E-way bill expired', 'k2')) x) s;
select pg_temp.rec('L07', 'history: 2 events, second has previous_reason = first', 'events=2 prev=first',
  format('reason=%L events=%s prev=%L', t.compliance_decline_reason, pg_temp.events(), e.payload->>'previous_reason'),
  t.compliance_decline_reason = 'E-way bill expired' and pg_temp.events() = 2
    and e.payload->>'previous_reason' = 'Invoice amount does not match LR')
from public.trips t
join public.trip_workflow_events e on e.trip_id = t.id and e.idempotency_key = t.id::text || ':compliance.declined:k2'
where t.id = pg_temp.fx('trip');

select pg_temp.rec('L08', 'replay of k2 (double submit) is a no-op', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('Should be ignored', 'k2')) x) s;
select pg_temp.rec('L08', 'after replay: still 2 events, reason unchanged', 'events=2',
  format('events=%s reason=%L', pg_temp.events(), (pg_temp.trip()).compliance_decline_reason),
  pg_temp.events() = 2 and (pg_temp.trip()).compliance_decline_reason = 'E-way bill expired');

-- Verify rule (D2 unchanged unless Dinesh changes it before the migration)
select pg_temp.rec('L09', 'server Verify rule is exactly LR + E-way Bill + Invoice',
  'v_required = lr, invoice, eway_bill', 'checked in pg_get_functiondef',
  pg_get_functiondef('public.mark_trip_compliance_verified(uuid)'::regprocedure)
    like '%v_required text[] := array[''lr'', ''invoice'', ''eway_bill''];%');

update public.trip_documents set status = 'verified'
 where trip_id = pg_temp.fx('trip') and document_type in ('lr', 'invoice');
update public.trip_documents set status = 'pending'
 where trip_id = pg_temp.fx('trip') and document_type = 'eway_bill';
select pg_temp.rec('L10', 'Verify blocked while E-way Bill not approved', 'ERR required documents: eway_bill', x,
  x like 'ERR[%]: required documents not yet verified: eway_bill%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.verify_sql()) x) s;

update public.trip_documents set status = 'verified'
 where trip_id = pg_temp.fx('trip') and document_type = 'eway_bill';
select pg_temp.rec('L11', 'required docs approved → Verify succeeds (vehicle/driver not checked by server)', 'OK', x, x like 'OK%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.verify_sql()) x) s;
select pg_temp.rec('L12', 'verified: verified_at/by set, decision approved; decline kept as history', 'verified, approved, declined_at kept',
  format('verified=%s by_ok=%s decision=%s declined_kept=%s', (pg_temp.trip()).compliance_verified_at is not null,
         (pg_temp.trip()).compliance_verified_by = pg_temp.fx('u_ok'), (pg_temp.trip()).compliance_decision,
         (pg_temp.trip()).compliance_declined_at is not null),
  (pg_temp.trip()).compliance_verified_at is not null and (pg_temp.trip()).compliance_verified_by = pg_temp.fx('u_ok')
    and (pg_temp.trip()).compliance_decision = 'approved' and (pg_temp.trip()).compliance_declined_at is not null);

select pg_temp.rec('L13', 'decline after verify rejected by server', 'ERR already verified', x, x like 'ERR[%]: trip compliance already verified%')
  from (select pg_temp.call_as(pg_temp.fx('u_ok'), pg_temp.decline_sql('Too late reason', 'k3')) x) s;

select step, case when pass is null then 'INFO' when pass then 'PASS' else 'FAIL' end as result,
       name, expected, left(actual, 130) as actual
  from r order by step, name;
rollback;
