# ADR-014 — One Pulse identity with Workspace-scoped RBAC (Gate B)

**Status:** Accepted (Product) — 2026-09-20  
**Gate:** B — CLOSED  
**Does not authorize:** V2 Auth, federation, broker, membership tables, RLS, Slice 4, infrastructure, Gate C

This is a **Product requirement**. It does **not** prescribe Auth architecture. **ADR-013 is unchanged.**

---

## GATE B — CLOSED: ONE PULSE IDENTITY WITH WORKSPACE-SCOPED AUTHORIZATION

Pulse requires one customer identity/account across the Pulse platform and services. Workspace is the operating and authorization boundary. A user may belong to multiple Workspaces, and each Workspace independently determines membership, RBAC permissions, Product/Experience access, views, actions and data visibility. One identity does not imply one global authorization context.

The Product requirement does not prescribe the technical Auth architecture. Production Auth and isolated V2 Auth remain separate architecture/infrastructure concerns under ADR-013.

---

## Product model

```text
Person / Identity
        ↓
Workspace Membership (verified; may be many)
        ↓
Active Workspace
        ↓
Role / RBAC (Workspace-scoped)
        ↓
Product / Experience / Module / Feature access
        ↓
Views, actions, Workspace-scoped data
```

**One identity, multiple workspace-specific authorization contexts.**

Login/account stays the same. Authorization context changes with the **active Workspace**.

Not allowed as a Product interpretation:

```text
Login → global permissions → access every Workspace
```

Caller-supplied `workspaceId` never grants access by itself. Trusted path remains:

**Actor → verified Membership → Workspace → AuthorizationContext**

---

## Requirements (P1–P10)

| ID | Requirement |
|----|-------------|
| **P1** | Single Pulse identity/account across the Pulse platform and its services (including Pulse V2). |
| **P2** | A Pulse identity may belong to multiple Workspaces. |
| **P3** | Every Workspace membership has its own authorization context. |
| **P4** | Roles and permissions are evaluated within the Workspace context. |
| **P5** | Product access, navigation, views, modules, features, and actions may differ by Workspace membership and RBAC. |
| **P6** | Access to business data is scoped to the authorized Workspace. |
| **P7** | The active Workspace establishes the authorization context for that session/action. |
| **P8** | Membership or permissions in Workspace A must not implicitly grant access to Workspace B. |
| **P9** | A Pulse identity is not itself a Workspace. |
| **P10** | Do not collapse Identity, Workspace, Organization, and Tenant. |

Existing GoGoX/Pulse customers should use the **same Pulse identity/account** across the ecosystem, including V2. That is identity continuity, not shared infrastructure.

---

## Validation (no silent architecture change)

| Source | Result |
|--------|--------|
| ADR-013 | **Compatible.** Product requires identity continuity; ADR-013 still forbids V2 using production Identity as the **runtime authorization path**, and still allows isolated V2 Auth. How continuity is implemented is not decided here. |
| `02-identity.md` | **Compatible.** Production “one account / one Auth project” remains the production plane. Law #6: Identity authenticates; it does not decide Workspace RBAC. |
| `03-workspace.md` | **Compatible.** Workspace remains the operating/data boundary, not a login or Auth account. |
| Identity Authorization Design / Identity Gate | **Compatible.** Membership selector; caller `workspaceId` never authority. |
| ADR-005 / Layer 1 | **Compatible.** Workspace = operating boundary; Products/Experiences sit under Workspace; Law #6. |

---

## Explicitly not decided (not Gate B)

V2 Auth architecture; production/V2 federation or broker; Auth provider; `auth.users` layout; Person vs Auth user; membership/RBAC schema; permission catalog freeze; RLS; Tenant; Organization → Workspace mapping; Hono; V2 infrastructure; local vs hosted; Slice 4.

**Next gate when asked:** Gate C — Infrastructure (not started by this ADR).
