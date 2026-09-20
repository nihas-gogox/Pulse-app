# Pulse V2 — first architecture-enforcement slice

Isolated from production Pulse (Expo app, `features/`, `lib/supabase`, shared hosted Supabase).

**Not in this slice:** Kafka, Redis, Kubernetes, service mesh, HTTP between modules, `packages/platform/identity`, production migrations, Finance/Commerce/Execution process extraction.

## Environment isolation

V2 reads **only** `PULSE_V2_*` variables. It never reads `EXPO_PUBLIC_SUPABASE_*` or `VITE_SUPABASE_*`, so a developer `.env` pointed at production cannot silently become the V2 backend.

| `PULSE_V2_SUPABASE_URL` | Result |
|-------------------------|--------|
| unset / empty | In-memory data plane (this slice) |
| `http://127.0.0.1:54321` (or RFC1918 LAN) | Allowed as local Supabase **target label only** — this slice still does not run `supabase/migrations` |
| Hosted `*.supabase.co` | **Rejected** unless a future infra approval sets allow-flags; production/preprod refs are **always** rejected |

Copy `.env.v2.example`. Do not provision a dedicated hosted V2 project in this slice.

Blocked project refs: `packages/pulse-v2/src/env/productionProjectRefs.ts`.

Production and V2 **must not** share `supabase/migrations` history. V2 does not add files there.

## In-process Gateway

`createPulseV2Gateway().execute({ domain, operation, payload, correlationId })`

Commerce `createOrder` persists `sales_orders` in the Commerce store, then creates a trip **only** by `execute({ domain: "execution", ... })`. No HTTP.

## Domain table CI

`scanV2DomainTables` fails if V2 `src/domains/<name>` contains `.from("<table>")` for a table owned by another domain, or if Gateway/env code queries tables.

```bash
npm run test:v2
npm run check:v2-boundaries
```

## Package

`@pulse/v2` — workspace member via `packages/*`. The Expo app does **not** depend on it.
