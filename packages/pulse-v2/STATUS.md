# Pulse V2 status

| Gate | Status |
|------|--------|
| Slice 1 — Isolation / in-process Gateway / table guards | **ACCEPTED / CLOSED** (`1ded2a6f`, `2ef606d2`) |
| Slice 2 — Persistence isolation | **ACCEPTED / CLOSED** (`acc789fc`, caveat `1873b136`) |
| Slice 3 — Identity & Authorization **design** | **DESIGN ACCEPTED** (`b9743770`, `IDENTITY_AUTHORIZATION_DESIGN.md`) — §2 Model A recommendation is **historical**; see OPEN A |
| Identity Gate — formal decision record | **PARTIAL** — `IDENTITY_GATE_DECISIONS.md`; OPEN A **RESOLVED** (Decision 8); other owner items remain |
| Gate A — Architecture conflicts | **CLOSED** — ADR-013 |
| Gate B — One identity + one Workspace context | **CLOSED** — ADR-014 |
| Gate C — Infrastructure | **CLOSED — LOCAL V2-ONLY** — ADR-015 |
| V2 Quality Charter | **ESTABLISHED** — `PULSE_V2_QUALITY_CHARTER.md` |
| Slice 4 — Authorization **design** | **OWNER-ACCEPTED** (`SLICE_4_AUTHORIZATION_DESIGN.md`) |
| Slice 4 — Runtime (trusted ctx + SEC-001) | Established at `a60aad5a`; later hardening through SEC-006 |
| SEC-001 | **CLOSED** (`5f7c43e4` review) |
| SEC-006 | **CLOSED** (`87720396`) |
| SEC-007 | **DEFERRED** (not a security prerequisite) |
| V2 implementation | **UNFROZEN for Persistent Commerce/Execution only** — Identity/Auth still frozen |
| Persistent Commerce/Execution | **AUTHORIZED** (owner: AUTHORIZE PERSISTENT COMMERCE/EXECUTION) |
| OPEN A — Auth Subject → Actor | **RESOLVED — MODEL B** (`OPEN_A_DECISION.md`) |
| OPEN A — Implementation plan | **READY** (`OPEN_A_IMPLEMENTATION_PLAN.md`) — **code NOT authorized** |
| OPEN B — Permission catalog | **OPEN** |
| Auth / Membership persistence / RLS / hosted V2 / Slice 5 | **NOT AUTHORIZED** |
| Command Store / Timeline / Observatory | **NOT AUTHORIZED** |
| Customer / product workflow | **BLOCKED** |
| OPEN B runtime / RBAC | **NOT AUTHORIZED** |

Quality contract: `PULSE_V2_QUALITY_CHARTER.md`. Gate C: local-only. Production Auth, `auth.users`, `organization_members`, production migrations, and the Oct 1 line remain **untouched**.

Owner authorization for this slice (nothing else):

```text
Commerce persistence: AUTHORIZED
Execution persistence: AUTHORIZED
Identity/Auth: NOT AUTHORIZED
Membership/Workspace persistence: NOT AUTHORIZED
RLS: NOT AUTHORIZED
Hosted V2: NOT AUTHORIZED
Production: FROZEN
```

Slice 5 and Identity/Auth remain unauthorized. OPEN A is an approved architectural design but **not** implementation authorization. OPEN B remains unresolved. SEC-007 remains deferred. Persistent Identity, persistent Membership/Workspace, Auth, RLS, hosted V2, Command Store, Timeline, Observatory, customer proof, and RBAC implementation remain unauthorized unless separately approved.

Current runtime (memory Identity, Commerce/Execution may use local durable persistence, production untouched):

```text
Gateway → trusted AuthorizationContext → domain handlers → workspace-scoped persistence
```

Trusted path: **validated Auth Subject → Pulse Actor (bind) → verified Membership → Workspace → AuthorizationContext**. Caller `actorId` / `workspaceId` are never authority. `membershipId` is a **selector**.

## OPEN A

Owner-accepted: **Model B**, 1 Auth Subject → 1 Actor, first-login **create Actor** (no auto-Membership). Person/Model C not required. Auth authenticates; Pulse authorizes.

Formal record: `OPEN_A_DECISION.md`. Plan: `OPEN_A_IMPLEMENTATION_PLAN.md`. Pre-decision analysis: `OPEN_A_AUTH_ACTOR_DESIGN.md`.

Do **not** implement Auth, tables, JWT, RLS, or Slice 5 until separately authorized.

## Identity Gate (remaining open)

Organization→Workspace mapping keys; holding-company Tenant; production/V2 identity **continuity implementation** (federation/broker); exact RLS plumbing; permission mapping + `06-permissions.md` (OPEN B); Hono port/extract. Person entity is **not required** (OPEN A). Hosted V2 remains later Infrastructure.

## Slice 2 caveat

**Workspace-scoped persistence implemented; trusted tenant authorization is Gateway AuthorizationContext (Slice 4). Real Auth + persistent Identity remain unauthorized.**
