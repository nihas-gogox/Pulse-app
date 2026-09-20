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

## Workspace scope vs tenant authorization

**Workspace-scoped persistence implemented.** Runtime tenancy for Commerce/Execution is copied from trusted Gateway `AuthorizationContext.workspaceId` (Slice 4), not from payload authority.

Historical Slice 2 note: adapters still accept a `V2TenantContext` DTO; off-Gateway tests may construct that DTO directly.

- RLS enabled, **no policies** → deny for anon/authenticated. Do not add permissive policies to “make hosted work”.
- Domain adapters never receive `PULSE_V2_SUPABASE_SERVICE_ROLE_KEY`.
- Do not invent a temporary JWT/membership implementation. `packages/platform/identity` stays dormant.

## Apply (local only, never hosted, never production)

SQL in this tree is the V2 schema fence. It is not the active application store for Commerce/Execution.

Current application persistence:

```text
memory            — in-process Maps (tests)
local-durable     — JSON files via PULSE_V2_DATA_DIR (not Postgres)
local-supabase    — dormant PostgREST adapters; Gateway requires an injected client
```

Deny-all RLS is unchanged. `anon`/`authenticated` still cannot see `v2_commerce` / `v2_execution` rows. Hosted `*.supabase.co` is unauthorized. Production remains frozen.

Guard: `assertV2MigrationApplyAllowed`.

`createOrder` nested trip: if Execution persistence fails, Commerce deletes the just-created order (workspace-scoped compensation). That is not a distributed transaction and not an event bus.
