-- One cheap snapshot of PostgREST / catalog SQL. Repeat from catalog_watch.sh.
-- Discriminator: same pid + growing query_s vs new pid / young backend_s.

select jsonb_pretty(
  jsonb_build_object(
    'checked_at', clock_timestamp(),
    'self_pid', pg_backend_pid(),
    'catalog_or_postgrest', coalesce((
      select jsonb_agg(row_to_json(s) order by s.query_s desc nulls last)
      from (
        select
          pid,
          usename,
          application_name,
          state,
          wait_event_type,
          wait_event,
          round(extract(epoch from (clock_timestamp() - query_start))::numeric, 1) as query_s,
          round(extract(epoch from (clock_timestamp() - xact_start))::numeric, 1) as xact_s,
          round(extract(epoch from (clock_timestamp() - backend_start))::numeric, 1) as backend_s,
          backend_start,
          query_start,
          xact_start,
          left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 200) as query
        from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and (
            application_name ilike '%postgrest%'
            or usename in ('authenticator', 'supabase_admin', 'supabase_auth_admin')
            or coalesce(query, '') ilike '%base_types%'
            or coalesce(query, '') ilike '%typbasetype%'
            or coalesce(query, '') ilike '%pg_catalog.pg_type%'
          )
        order by query_start nulls last
        limit 20
      ) s
    ), '[]'::jsonb)
  )
) as watch;
