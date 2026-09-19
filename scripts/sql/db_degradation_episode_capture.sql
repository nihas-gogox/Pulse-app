-- Passive episode capture: one JSON row so `supabase db query --linked -f` prints everything.
-- Do not use as a load test. Do not restart Postgres because Dashboard says Unhealthy.
-- Question this answers: with ~20–35 sessions, what wait/resource signal is present?

select jsonb_pretty(
  jsonb_build_object(
    'checked_at', now(),
    'sessions', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where state = 'active'),
        'idle', count(*) filter (where state = 'idle'),
        'idle_in_tx', count(*) filter (where state = 'idle in transaction'),
        'waiting_lock', count(*) filter (where wait_event_type = 'Lock'),
        'active_gt_5s', count(*) filter (
          where state = 'active' and query_start < now() - interval '5 seconds'
        ),
        'active_gt_15s', count(*) filter (
          where state = 'active' and query_start < now() - interval '15 seconds'
        )
      )
      from pg_stat_activity
      where datname = current_database()
        and pid <> pg_backend_pid()
    ),
    'non_idle', coalesce((
      select jsonb_agg(row_to_json(s) order by s.query_s desc nulls last)
      from (
        select
          pid,
          usename,
          application_name,
          state,
          wait_event_type,
          wait_event,
          round(extract(epoch from (now() - query_start))::numeric, 1) as query_s,
          round(extract(epoch from (now() - xact_start))::numeric, 1) as xact_s,
          round(extract(epoch from (now() - backend_start))::numeric, 1) as backend_s,
          backend_start,
          left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 160) as query
        from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and state is distinct from 'idle'
        order by query_start nulls last
        limit 30
      ) s
    ), '[]'::jsonb),
    'wait_events', coalesce((
      select jsonb_agg(row_to_json(w))
      from (
        select wait_event_type, wait_event, count(*) as n
        from pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and wait_event is not null
        group by 1, 2
        order by n desc
        limit 20
      ) w
    ), '[]'::jsonb),
    'blocking_note', 'pg_locks self-join omitted so this capture stays inside statement_timeout on a slow instance; use wait_event_type=Lock on sessions',
    'database_io', (
      select jsonb_build_object(
        'blks_hit', blks_hit,
        'blks_read', blks_read,
        'hit_ratio_pct', case
          when blks_hit + blks_read = 0 then null
          else round((100.0 * blks_hit / (blks_hit + blks_read))::numeric, 2)
        end,
        'tup_returned', tup_returned,
        'tup_fetched', tup_fetched,
        'tup_inserted', tup_inserted,
        'tup_updated', tup_updated,
        'tup_deleted', tup_deleted,
        'xact_commit', xact_commit,
        'xact_rollback', xact_rollback,
        'temp_files', temp_files,
        'temp_bytes', temp_bytes,
        'deadlocks', deadlocks,
        'conflicts', conflicts,
        'checksum_failures', checksum_failures,
        'stats_reset', stats_reset
      )
      from pg_stat_database
      where datname = current_database()
    ),
    'bgwriter', (
      select to_jsonb(bg.*)
      from pg_stat_bgwriter bg
    ),
    'wal', (
      select case
        when to_regclass('pg_catalog.pg_stat_wal') is null then null
        else (
          select to_jsonb(w.*)
          from pg_stat_wal w
        )
      end
    ),
    'autovacuum', coalesce((
      select jsonb_agg(row_to_json(v))
      from (
        select
          pid,
          wait_event_type,
          wait_event,
          round(extract(epoch from (now() - query_start))::numeric, 1) as query_s,
          left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 160) as query
        from pg_stat_activity
        where query ilike '%autovacuum%'
           or query ilike 'autovacuum:%'
        limit 10
      ) v
    ), '[]'::jsonb),
    'dead_tuples', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select relname, n_live_tup, n_dead_tup, seq_scan, idx_scan,
               last_autovacuum, last_autoanalyze
        from pg_stat_user_tables
        order by n_dead_tup desc
        limit 15
      ) t
    ), '[]'::jsonb),
    'cron_jobs', coalesce((
      select jsonb_agg(row_to_json(j) order by j.jobid)
      from (
        select jobid, coalesce(jobname, '') as jobname, schedule, active
        from cron.job
      ) j
    ), '[]'::jsonb),
    'recent_cron_runs_note', 'cron.job_run_details omitted (ordered scan can 57014); query start_time > now() - interval ''15 minutes'' separately if login is fast'
  )
) as episode;
