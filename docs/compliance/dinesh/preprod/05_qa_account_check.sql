-- QA account + E2E fixture readiness — READ-ONLY.
-- Do not run directly: qa_check.sh substitutes __QA_EMAIL__ from e2e/.env.e2e
-- (never printed) and runs this through run.sh. Output shows ids, not the email.
with u as (
  select id, email_confirmed_at is not null as confirmed from auth.users where lower(email) = lower('__QA_EMAIL__')
),
m as (
  select om.organization_id, o.name as org_name, om.role, om.status,
         om.role in ('owner', 'admin')
           or coalesce((om.permissions->'surfaces'->>'trip_compliance.trip.mark_verified')::boolean, false) as can_verify_decline,
         om.permissions->>'platformRole' as platform_role
    from public.organization_members om
    join u on u.id = om.user_id
    join public.organizations o on o.id = om.organization_id
),
p as (
  select org_id, bool_or(product_id = 'pulse_compliance' and status in ('active', 'trial')) as compliance_enabled
    from public.workspace_products where org_id in (select organization_id from m) group by org_id
),
latest as ( -- latest row per required trip doc type (approximates the table's Trip pill)
  select distinct on (d.trip_id, d.document_type) d.trip_id, d.document_type, d.status
    from public.trip_documents d
    join public.trips t on t.id = d.trip_id
   where t.organization_id in (select organization_id from m)
     and d.document_type in ('lr', 'invoice', 'eway_bill')
   order by d.trip_id, d.document_type, d.uploaded_at desc nulls first
),
f as (
  select t.organization_id,
         count(*) filter (where t.compliance_verified_at is null) as unverified_trips,
         count(*) filter (where t.compliance_verified_at is null
                            and (select count(*) from latest l where l.trip_id = t.id and l.status = 'verified') = 3) as unverified_with_trip_docs_approved
    from public.trips t where t.organization_id in (select organization_id from m) group by t.organization_id
)
select 'user' as check, case when exists (select 1 from u) then 'PASS' else 'FAIL' end as result,
       coalesce((select 'id=' || left(id::text, 8) || '… confirmed=' || confirmed from u), 'no auth user with that email') as detail
union all
select 'membership ' || left(m.organization_id::text, 8) || '… (' || m.org_name || ')',
       case when m.status = 'active' and m.can_verify_decline and coalesce(p.compliance_enabled, false)
            then 'PASS' else 'FAIL' end,
       format('status=%s role=%s platformRole=%s can_verify_decline=%s compliance_enabled=%s unverified_trips=%s ready_for_verify=%s',
              m.status, m.role, coalesce(m.platform_role, '-'), m.can_verify_decline, coalesce(p.compliance_enabled, false),
              coalesce(f.unverified_trips, 0), coalesce(f.unverified_with_trip_docs_approved, 0))
  from m left join p on p.org_id = m.organization_id left join f on f.organization_id = m.organization_id
union all
select 'fixtures (org that will be active in the app)',
       case when exists (select 1 from m join f on f.organization_id = m.organization_id
                          where f.unverified_trips > 0 and f.unverified_with_trip_docs_approved > 0) then 'PASS' else 'FAIL' end,
       'need ≥1 unverified trip (decline tests) and ≥1 unverified trip with LR/E-way/Invoice approved (verify-failure test)';
