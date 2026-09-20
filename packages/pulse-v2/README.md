# Pulse V2 — architecture enforcement + persistence isolation

Isolated from production Pulse (Expo app, `features/`, `lib/supabase`, shared hosted Supabase).

**Slices 1–2 accepted. Slice 3 design accepted. Gates A–C closed (ADR-013/014/015). Quality charter established. Slice 4 blocked.** See `STATUS.md` and `PULSE_V2_QUALITY_CHARTER.md`.

**Workspace-scoped persistence implemented; trusted tenant authorization pending Identity/Authorization decision.** Caller `workspaceId` is not tenant security.

**Not in this slice:** Kafka, Redis, Kubernetes, service mesh, HTTP Gateway, Hono Identity, production migrations, domain extraction, hosted V2 provisioning.

## Persistence flow

```text
Domain handlers
  → repository interface
  → V2 persistence adapter (memory default, or injected local client)
  → V2 database client (createV2DatabaseClient only; PULSE_V2_* only)
  → dedicated V2 Postgres (local schemas) — hosted not provisioned
```

Gateway routes `execute()` only. It does not query tables.

## Environment

Reads only: `PULSE_V2_SUPABASE_URL`, `PULSE_V2_SUPABASE_ANON_KEY`, `PULSE_V2_SUPABASE_SERVICE_ROLE_KEY`, `PULSE_V2_HOSTED_PROJECT_REF`, `PULSE_V2_ALLOW_HOSTED`.

Never: `EXPO_PUBLIC_*`, `VITE_*`, unprefixed `SUPABASE_*`.

Hosted `*.supabase.co` is always STOP (not provisioned). Production/preprod refs always blocked.

## Migrations

`packages/pulse-v2/supabase/migrations` — not `supabase/migrations`. See `packages/pulse-v2/supabase/SCHEMA.md`. Do not apply to production.

```bash
npm run test:v2
npm run check:v2-boundaries
```
