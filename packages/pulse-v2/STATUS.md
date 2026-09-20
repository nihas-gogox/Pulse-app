# Pulse V2 status

| Gate | Status |
|------|--------|
| Slice 1 — Isolation / in-process Gateway / table guards | **ACCEPTED / CLOSED** (`1ded2a6f`, `2ef606d2`) |
| Slice 2 — Persistence isolation | **ACCEPTED / CLOSED** (`acc789fc`, caveat `1873b136`) |
| Slice 3 — Identity & Authorization **design** | **DESIGN ACCEPTED** (`b9743770`, `IDENTITY_AUTHORIZATION_DESIGN.md`) |
| Identity Gate — formal decision record | **PARTIAL** — Architecture invariants frozen in `IDENTITY_GATE_DECISIONS.md`; owner-required items remain open |
| Gate A — Architecture conflicts (Auth plane + ADR-001 vs `v2_identity`) | **CLOSED** — ADR-013 (`docs/ADR-013-pulse-v2-identity-plane.md`), C1-B + C2-B |
| Gate B — Product one identity + one authorized Workspace context | **CLOSED** — ADR-014 (`docs/ADR-014-one-identity-workspace-rbac.md`) |
| Gate C — Infrastructure | **NOT STARTED** |
| Slice 4 — Identity implementation / trusted context / RLS | **BLOCKED** |
| Customer / product workflow | **BLOCKED** |

Do **not** implement Identity, weaken deny-all RLS, wire Hono, federate production Auth, provision hosted V2, or start customer workflow until owner-required Identity Gate items are approved **and** dedicated V2 infrastructure is approved/provisioned for real Auth/RLS.

Trusted workspace context must come from **verified Actor → Membership**, never from caller `workspaceId`. `membershipId` on a request is a **selector**, not authority.

## Identity Gate

Formal record: `IDENTITY_GATE_DECISIONS.md`.

Architecture has frozen Workspace-as-entity, V2-owned Auth as default, V2 membership authority, trusted workspace derivation, deny-all RLS principle, no fourth permission catalog, Gateway-first, and Hono dormant.

Still **OPEN — OWNER REQUIRED** (not settled by Architecture recommendation): Organization→Workspace mapping keys; holding-company Tenant; production/V2 identity continuity *implementation* (federation/broker); Person vs `auth.users`; exact RLS plumbing; permission mapping + `06-permissions.md` freeze; Hono port/extract; V2 infra/Auth provisioning.

Owner intake: `IDENTITY_GATE_OWNER_INTAKE.md`. Product Gate B is closed (ADR-014). Security/Infrastructure approvals still missing. Slice 4 remains **NOT AUTHORIZED**.

Gate A is closed (Architecture). Gate B is closed (Product). Do **not** start Gate C until asked.

Next work, when asked: **Gate C** (Infrastructure) — **not** Slice 4 implementation.

## Slice 2 caveat (do not misread)

**Workspace-scoped persistence implemented; trusted tenant authorization pending Identity/Authorization decision.**
