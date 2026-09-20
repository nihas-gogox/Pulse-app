# ADR-015 — Pulse V2 data plane infrastructure (Gate C)

**Status:** Accepted (Infrastructure posture) — 2026-09-20  
**Gate:** C — CLOSED — LOCAL V2-ONLY  
**Does not authorize:** hosted Supabase provisioning, V2 Auth implementation, membership tables, RLS policies, Slice 4, federation, production changes

ADR-013 and ADR-014 are **unchanged**.

---

## GATE C — CLOSED: LOCAL V2-ONLY

For the **current V2 phase** (architecture validation, tests, and any later Identity work that is separately authorized), Pulse V2 lives on a **local V2-only** data plane:

- in-memory default, or
- local Supabase/Postgres (`127.0.0.1` / `localhost` on the V2 env keys),

with migrations only under `packages/pulse-v2/supabase/migrations`.

A **dedicated hosted V2** project is **not required** for this phase and is **not provisioned**. Production remains excluded.

---

## Evidence

**VERIFIED FROM REPOSITORY**

- Slice 2: `V2DataPlaneMode` is `"memory" | "local-supabase"` only (`packages/pulse-v2/src/env/v2SupabaseEnv.ts`).
- Hosted `*.supabase.co` is **STOP** unless a future approval sets `PULSE_V2_ALLOW_HOSTED` and a non-production `PULSE_V2_HOSTED_PROJECT_REF`. Production/preprod refs stay blocked.
- SCHEMA.md: apply **local only, never hosted, never production**. Guard: `assertV2MigrationApplyAllowed`.
- Default persistence is in-memory; no hosted project exists.
- Customer / product workflow and Slice 4 are **BLOCKED**. There is no V2 Experience requiring remote customer/pilot access.
- ADR-013 permits isolated V2 Auth when provisioned; it does not require a hosted project now.
- ADR-014 is Product identity continuity, not shared or hosted Auth.

What this phase is proving: isolation from production, modular Gateway/persistence, Identity **design**. Not availability, PITR, or external pilots.

Local V2 (or memory) can support: isolated Postgres/schemas, V2 migration history, Auth **capability** of local Supabase Auth when a local stack is used, membership/RBAC/RLS **tests**, multiple test users and Workspace **rows** while Product still uses one authorized Workspace context per session, Jest (`test:v2`), repeatable local setup.

Local cannot prove (and this phase does not require): hosted Auth SaaS behavior, remote networking, customer/pilot access, PITR, production-scale ops.

C2 would add isolation of a remote project, hosted Auth, backup/PITR, remote access — **premature** while Slice 4 and customer workflow are unauthorized and the client already STOPs hosted URLs.

---

## Decision table

| Item | Decision |
| ------------------------ | ------------ |
| V2 environment | **Local V2-only** (memory or local Supabase). Hosted not provisioned. |
| Production isolation | **REQUIRED** |
| V2 Postgres | Local (when URL set) or none (memory). Not production. |
| V2 Auth capability | Local stack **may** include Auth when Identity work is later authorized. Not provisioned here. |
| V2 migration plane | `packages/pulse-v2/supabase/migrations` only |
| V2 secrets | `PULSE_V2_*` only. No production credential reuse. |
| Backup/PITR | **Not required** for this phase |
| Observability | Test/local logs sufficient for this phase |
| Customer/pilot access | **Not required** for this phase |
| Provisioning authorized? | **NO** (no hosted project, no Auth users, no Identity tables) |
| Slice 4 authorized? | **NO** |

---

## Minimum before real V2 Identity implementation (later, not this ADR)

Isolated V2 Postgres (local), V2 migrations, `PULSE_V2_*` secrets, least privilege (no service-role in domain adapters), deny-all RLS until trusted context exists. Auth capability on that local stack when Architecture specifies it. Hosted backup/PITR when a **future** hosted phase is approved.

---

## Not decided by Gate C

Technical one-login / federation / broker / linking / token exchange; Auth provider internals; Person vs `auth.users`; membership/RBAC schema; permission catalog; RLS implementation; Tenant; Organization → Workspace mapping; Hono; Slice 4 scope; production cutover; dedicated hosted V2.

A later Infrastructure decision may adopt C2 without reopening ADR-013/014.

---

## Comparison (factual)

| Dimension | Local V2-only | Dedicated hosted V2 |
| -------------------------------- | ------------- | ------------------- |
| V2 Postgres | Local process or memory | Separate hosted DB (not provisioned) |
| V2 Auth capability | Local GoTrue if local stack used | Hosted Auth (not provisioned) |
| V2 Identity | Schema fence; zero tables | Same fence; still not implemented |
| V2 migrations | V2 tree, local apply only | Same tree; hosted apply currently STOP |
| Workspace/RBAC testing | Yes, in tests/local | Possible; not needed now |
| RLS testing | Yes against local deny-all | Possible; not needed now |
| Production isolation | Enforced by env guards | Also isolated **if** never production |
| Multi-user testing | Local Auth users / fixtures | Remote users |
| Customer/pilot access | No | Possible; Product workflow still blocked |
| Backup/PITR | Local responsibility / none | Provider PITR if hosted |
| Recovery | Recreate local / reset | Hosted restore |
| Observability | Local/test | Hosted logs |
| Secrets management | Dev env / `.env` V2 keys | Hosted secret store |
| Deployment repeatability | `npm test` + local supabase | Extra env + project |
| Operational overhead | Low | Higher |
| Cost | Dev machine | Hosted project |
| Enterprise-readiness evidence | Isolation + tests | Ops/PITR evidence |
| Suitability for current V2 phase | **Sufficient** | **Not required** |
