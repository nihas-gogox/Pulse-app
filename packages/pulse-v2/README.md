# Pulse V2 — architecture enforcement + persistence isolation

Isolated from production Pulse (Expo app, `features/`, `lib/supabase`, shared hosted Supabase).

**Slices 1–2 accepted. Slice 3 design accepted. Gates A–C closed (ADR-013/014/015). Quality charter established. Slice 4 runtime through SEC-006 is closed. Persistent Commerce/Execution, Persistence Hardening, and local V2 Identity/Auth are complete.** See `STATUS.md` and `PULSE_V2_QUALITY_CHARTER.md`.

**Workspace tenancy** is copied from sealed Gateway `AuthorizationContext.workspaceId`. Caller `workspaceId` is not authority.

**Not authorized:** Event Timeline, Observatory, Event publishing, RLS, hosted V2, production Auth, Kafka, Redis, Kubernetes, service mesh, HTTP Gateway, Hono extract, production migrations, domain extraction.

## Persistence modes

```text
unset PULSE_V2_SUPABASE_URL + unset PULSE_V2_DATA_DIR
    → memory (unit tests)

absolute PULSE_V2_DATA_DIR + no URL
    → local-durable = JSON file persistence
      v2_commerce.sales_orders.json
      v2_execution.trips.json
      v2_identity.json (auth_subjects, actors, workspaces, memberships)
      v2_platform.command_store.json
      v2_platform.timeline.json
      not local Postgres

local PULSE_V2_SUPABASE_URL + anon key
    → local-supabase PostgREST path for Commerce/Execution (dormant)
      Identity stays memory in this mode (no PostgREST identity adapter)
      RLS remains deny-all

hosted *.supabase.co / production refs
    → STOP

URL + DATA_DIR together
    → STOP
```

Local Auth is `createLocalAuthAdapter` (opaque enrolled proofs → Auth Subject). Pulse Identity is `createV2IdentityPort` (Model B: 1 Subject → 1 Actor, first login creates Actor, no auto-Membership). Production Auth / `auth.users` / `organization_members` are not used.

```text
Domain handlers
  → repository interface
  → persistence adapter (memory | local-durable JSON | dormant local-supabase)
```

Gateway routes `execute()` only. It does not query tables or files. Mutating public operations (`createOrder`, `createTripFromOrder`) go through Command Store; first COMPLETED appends one command Timeline entry. Queries do not. See `COMMAND_STORE_INTEGRATION.md` and `TIMELINE_RUNTIME.md`.

Hosted V2 is unauthorized. Production remains frozen.

## Environment

Reads only: `PULSE_V2_SUPABASE_URL`, `PULSE_V2_SUPABASE_ANON_KEY`, `PULSE_V2_SUPABASE_SERVICE_ROLE_KEY`, `PULSE_V2_HOSTED_PROJECT_REF`, `PULSE_V2_ALLOW_HOSTED`, `PULSE_V2_DATA_DIR`.

Never: `EXPO_PUBLIC_*`, `VITE_*`, unprefixed `SUPABASE_*`.

Hosted `*.supabase.co` is always STOP (not provisioned). Production/preprod refs always blocked.

## Migrations

`packages/pulse-v2/supabase/migrations` — not `supabase/migrations`. See `packages/pulse-v2/supabase/SCHEMA.md`. Do not apply to production.

```bash
npm run test:v2
npm run check:v2-boundaries
```
