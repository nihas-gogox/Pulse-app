# Migration — trip compliance decline

File: `supabase/migrations/20270929162901_trip_compliance_decline.sql`
Status: **written, not applied** to any database.

## What it adds

- `public.trips` — 3 nullable columns:
  - `compliance_declined_at timestamptz`
  - `compliance_declined_by uuid references auth.users(id)`
  - `compliance_decline_reason text`
- Constraint `trips_compliance_decline_reason_length_check`: reason is null or 3–500 chars (dropped-if-exists then added, so re-runs are safe).
- RPC `public.decline_trip_compliance(p_trip_id uuid, p_reason text, p_idempotency_key text default null) returns void`
  - SECURITY DEFINER, `search_path = public`, surface `trip_compliance.trip.mark_verified`.
  - Locks the trip row; errors if `compliance_verified_at` is set; trims reason, requires 3–500 chars.
  - Writes a `trip_workflow_events` row `compliance.declined`, payload `{reason, previous_reason}`.
  - With an idempotency key the event (key `trip_id:compliance.declined:<key>`) is inserted first; a duplicate key returns without updating the trip.
  - `execute` granted to `authenticated`; revoked from `public` and `anon`.
- Not changed: `mark_trip_compliance_verified`, `approve_trip_compliance_with_exception`.

## Safety for existing rows

- All new columns are nullable, no default, no backfill. Existing trips read as "never declined".
- Adding nullable columns without defaults is metadata-only in Postgres (no table rewrite).
- The check constraint is added `NOT VALID` (a brief metadata-only `ACCESS EXCLUSIVE` lock, no scan), then `VALIDATE CONSTRAINT` scans under `SHARE UPDATE EXCLUSIVE`, which doesn't block reads or writes. Every existing value is null, so validation passes.
- No existing trigger, policy or function on `trips` / `trip_workflow_events` refers to these names (checked on remote 2026-09-29). `trip_workflow_events.event_type` has no check constraint, so `compliance.declined` is accepted.
- The client already handles a database without this migration: `fetchComplianceTripFlags` falls back to the old select, and `declineTripCompliance` shows "Decline isn't available yet — database update pending."

## Deploy (only after approval)

1. `npm run db:preflight`
2. `supabase migration list --linked` — confirm remote head is still `20270928114500` and this file is the only local-only migration.
3. `npm run db:push`
   - `--include-all` is **not** needed: `20270929162901` sorts after the remote head `20270928114500`.
4. Run the verification queries below.

## Verification queries (read-only)

```sql
-- columns
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'trips'
   and column_name in ('compliance_declined_at','compliance_declined_by','compliance_decline_reason');

-- constraint
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.trips'::regclass
   and conname = 'trips_compliance_decline_reason_length_check';

-- function + grants
select pg_get_functiondef('public.decline_trip_compliance(uuid, text, text)'::regprocedure);
select grantee, privilege_type
  from information_schema.routine_privileges
 where routine_schema = 'public' and routine_name = 'decline_trip_compliance';

-- migration recorded
select version from supabase_migrations.schema_migrations where version = '20270929162901';

-- after a test decline
select event_type, payload, idempotency_key, created_at
  from public.trip_workflow_events
 where event_type = 'compliance.declined'
 order by created_at desc limit 5;
```

Run with `supabase db query "<SQL>" --linked -o table`.

## Rollback (compensating migration)

Create a new forward migration (never edit the applied one). **This permanently deletes the decline columns and their data** (current reason / who / when). `trip_workflow_events` rows with `event_type = 'compliance.declined'` stay as history.

```sql
drop function if exists public.decline_trip_compliance(uuid, text, text);

alter table public.trips
  drop constraint if exists trips_compliance_decline_reason_length_check;

alter table public.trips
  drop column if exists compliance_decline_reason,
  drop column if exists compliance_declined_by,
  drop column if exists compliance_declined_at;
```

Ship the client change that stops calling `decline_trip_compliance` first, or with it. The read fallback keeps the app working once the columns are gone.
