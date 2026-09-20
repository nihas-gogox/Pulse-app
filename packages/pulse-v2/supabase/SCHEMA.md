# Pulse V2 database schema (ownership fence)

This tree is **not** `supabase/migrations` at the repo root. History is independent.
Do not `supabase db push --linked` these files against production.

## Schemas

| Schema | Owner | Tables in this slice |
|--------|--------|----------------------|
| `v2_identity` | Identity | none (identity model not approved) |
| `v2_commerce` | Commerce | `sales_orders` |
| `v2_execution` | Execution | `trips` |
| `v2_finance` | Finance | none (extraction blocked) |
| `v2_network` | Network | none (modular) |

Reserved names (not created): Commerce `commerce_products`, `commerce_inventory`; Execution `indents`, `trip_documents`, `execution_plan_stops`.

Open (no schema here): Driver/Workforce, Documents/POD, Compliance, Communications.

## Tenant / RLS prerequisites (not implemented as identity)

- Every row has `workspace_id` supplied by the caller.
- RLS enabled, **no policies** → deny for anon/authenticated.
- Domain adapters never receive `PULSE_V2_SUPABASE_SERVICE_ROLE_KEY`.
- JWT/membership/RLS using identity claims wait on the identity decision. `packages/platform/identity` stays dormant.

## Apply (local only, never hosted, never production)

Not executed by this slice. Guard: `assertV2MigrationApplyAllowed`.
