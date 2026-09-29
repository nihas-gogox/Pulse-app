-- Post-migration schema acceptance — READ-ONLY. Every row must say PASS.
-- Run: bash docs/compliance/dinesh/preprod/run.sh docs/compliance/dinesh/preprod/01_schema_checks.sql
with c as (
  select column_name, data_type, is_nullable, column_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'trips'
     and column_name in ('compliance_declined_at', 'compliance_declined_by', 'compliance_decline_reason')
),
checks(name, ok, detail) as (
  select 'migration 20270929162901 recorded',
         exists (select 1 from supabase_migrations.schema_migrations where version = '20270929162901'), ''
  union all
  select 'col compliance_declined_at timestamptz, nullable, no default',
         exists (select 1 from c where column_name = 'compliance_declined_at' and data_type = 'timestamp with time zone'
                 and is_nullable = 'YES' and column_default is null), ''
  union all
  select 'col compliance_declined_by uuid, nullable, no default',
         exists (select 1 from c where column_name = 'compliance_declined_by' and data_type = 'uuid'
                 and is_nullable = 'YES' and column_default is null), ''
  union all
  select 'col compliance_decline_reason text, nullable, no default',
         exists (select 1 from c where column_name = 'compliance_decline_reason' and data_type = 'text'
                 and is_nullable = 'YES' and column_default is null), ''
  union all
  select 'no existing trip has decline data (no backfill)',
         not exists (select 1 from public.trips
                      where compliance_declined_at is not null or compliance_declined_by is not null
                         or compliance_decline_reason is not null),
         (select count(*)::text from public.trips where compliance_declined_at is not null)
  union all
  select 'FK compliance_declined_by -> auth.users ON DELETE SET NULL',
         exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and contype = 'f'
                 and pg_get_constraintdef(oid) like 'FOREIGN KEY (compliance_declined_by) REFERENCES auth.users(id) ON DELETE SET NULL'),
         coalesce((select string_agg(pg_get_constraintdef(oid), '; ') from pg_constraint
                    where conrelid = 'public.trips'::regclass and pg_get_constraintdef(oid) like '%compliance_declined_by%'), 'missing')
  union all
  select 'check trips_compliance_decline_reason_length_check validated, 3..500',
         exists (select 1 from pg_constraint where conname = 'trips_compliance_decline_reason_length_check'
                 and convalidated and pg_get_constraintdef(oid) like '%char_length(compliance_decline_reason) >= 3%'
                 and pg_get_constraintdef(oid) like '%char_length(compliance_decline_reason) <= 500%'),
         coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'trips_compliance_decline_reason_length_check'), 'missing')
  union all
  select 'fn decline_trip_compliance(uuid,text,text): SECURITY DEFINER, search_path=public, owner postgres',
         exists (select 1 from pg_proc where oid = to_regprocedure('public.decline_trip_compliance(uuid,text,text)')
                 and prosecdef and proconfig @> array['search_path=public'] and pg_get_userbyid(proowner) = 'postgres'),
         coalesce((select 'secdef=' || prosecdef || ' cfg=' || array_to_string(proconfig, ',') || ' owner=' || pg_get_userbyid(proowner)
                     from pg_proc where oid = to_regprocedure('public.decline_trip_compliance(uuid,text,text)')), 'missing')
  union all
  select 'fn guard_trip_compliance_decline_columns(): NOT security definer, search_path=public',
         exists (select 1 from pg_proc where oid = to_regprocedure('public.guard_trip_compliance_decline_columns()')
                 and not prosecdef and proconfig @> array['search_path=public']), ''
  union all
  select 'trigger trg_guard_trip_compliance_decline_columns enabled, BEFORE UPDATE OF the 3 columns',
         exists (select 1 from pg_trigger where tgrelid = 'public.trips'::regclass
                 and tgname = 'trg_guard_trip_compliance_decline_columns' and tgenabled = 'O'
                 and pg_get_triggerdef(oid) like '%BEFORE UPDATE OF compliance_declined_at, compliance_declined_by, compliance_decline_reason ON public.trips FOR EACH ROW EXECUTE FUNCTION %guard_trip_compliance_decline_columns()%'),
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_guard_trip_compliance_decline_columns'), 'missing')
  union all
  select 'EXECUTE decline: authenticated YES',
         (case when to_regprocedure('public.decline_trip_compliance(uuid,text,text)') is null then false else has_function_privilege('authenticated', 'public.decline_trip_compliance(uuid,text,text)', 'EXECUTE') end), ''
  union all
  select 'EXECUTE decline: anon NO',
         to_regprocedure('public.decline_trip_compliance(uuid,text,text)') is not null and not (case when to_regprocedure('public.decline_trip_compliance(uuid,text,text)') is null then false else has_function_privilege('anon', 'public.decline_trip_compliance(uuid,text,text)', 'EXECUTE') end), ''
  union all
  select 'EXECUTE decline: PUBLIC NO (no "=X/" entry in ACL)',
         to_regprocedure('public.decline_trip_compliance(uuid,text,text)') is not null and not exists (select 1 from pg_proc p, unnest(coalesce(p.proacl, '{}')) a
                      where p.oid = to_regprocedure('public.decline_trip_compliance(uuid,text,text)') and a::text like '=%'),
         (select coalesce(array_to_string(proacl, ','), 'default-acl') from pg_proc
           where oid = to_regprocedure('public.decline_trip_compliance(uuid,text,text)'))
  union all
  select 'EXECUTE guard fn: authenticated/anon NO',
         to_regprocedure('public.guard_trip_compliance_decline_columns()') is not null and not (case when to_regprocedure('public.guard_trip_compliance_decline_columns()') is null then false else has_function_privilege('authenticated', 'public.guard_trip_compliance_decline_columns()', 'EXECUTE') end)
         and not (case when to_regprocedure('public.guard_trip_compliance_decline_columns()') is null then false else has_function_privilege('anon', 'public.guard_trip_compliance_decline_columns()', 'EXECUTE') end), ''
  union all
  select 'mark_trip_compliance_verified unchanged: requires exactly lr, invoice, eway_bill',
         (select pg_get_functiondef('public.mark_trip_compliance_verified(uuid)'::regprocedure))
           like '%v_required text[] := array[''lr'', ''invoice'', ''eway_bill''];%', ''
  union all
  select 'approve_trip_compliance_with_exception still present',
         to_regprocedure('public.approve_trip_compliance_with_exception(uuid,text)') is not null, ''
)
select case when ok then 'PASS' else 'FAIL' end as result, name, left(detail, 140) as detail
  from checks order by ok, name;
