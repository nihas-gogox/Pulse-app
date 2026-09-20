# ADR-014 — One Pulse identity + one authorized Workspace context (Gate B)

**Status:** Accepted (Product) — 2026-09-20; **revised** 2026-09-20 (one Workspace context for current V2)  
**Gate:** B — CLOSED  
**Does not authorize:** V2 Auth, federation, broker, membership tables, RLS, Slice 4, infrastructure, Gate C

This is a **Product requirement**. It does **not** prescribe Auth architecture. **ADR-013 is unchanged.**

The first Gate B close (`3bd180f4`) stated that a user may belong to multiple Workspaces. That wording is **superseded** for **current V2 Product**. Multi-Workspace membership/switching is deferred, not an irreversible architecture law.

---

## GATE B — CLOSED: ONE PULSE IDENTITY + ONE AUTHORIZED WORKSPACE CONTEXT

Pulse requires one customer identity/account across the Pulse platform and services. Following authentication, the user's verified Workspace establishes the operating context for the session. RBAC, Product access, views, actions and business-data access are evaluated within that Workspace. The current V2 Product model does not include multi-Workspace switching or simultaneous multi-Workspace operation.

This Product requirement does not prescribe the technical Auth architecture. Production Auth and isolated V2 Auth remain separate Architecture/Infrastructure concerns under ADR-013.

Multi-Workspace membership or switching is intentionally deferred and requires a future Product/Architecture decision if introduced.

---

## Product model (current V2)

```text
User / Person
      ↓
Authentication
      ↓
Authorized Workspace (verified; one context for the session)
      ↓
Workspace RBAC / Role
      ↓
Products / Experiences / Modules / Features
      ↓
Workspace-scoped data
```

**One identity, one authorized Workspace context at a time for current V2.**

Not allowed as a V2 Product interpretation:

```text
Login → global permissions → access every Workspace
```

Do not introduce as a V2 requirement: Workspace switchers, multi-Workspace dashboards, simultaneous Workspace contexts, cross-Workspace authorization, or global permissions spanning Workspaces.

Caller-supplied `workspaceId` never establishes authorization. Trusted path remains:

**Actor → verified Membership → Workspace → AuthorizationContext**

The Product model does not expose arbitrary Workspace selection from the client. The system must resolve/verify the user's authorized Workspace before establishing the authorization context.

---

## Requirements (P1–P10)

| ID | Requirement |
|----|-------------|
| **P1** | One Pulse identity/account across the Pulse platform and services (including V2). |
| **P2** | After authentication, the user's authorized Workspace establishes the operating context. |
| **P3** | Current V2 operates with **one** authorized Workspace context for a user/session. |
| **P4** | Roles and permissions are evaluated within that Workspace. |
| **P5** | Product access, navigation, views, modules, features, and actions are determined within that Workspace. |
| **P6** | Business data access is restricted to the authorized Workspace. |
| **P7** | Authentication alone does not grant access to all Workspaces or all Pulse capabilities. |
| **P8** | A Pulse identity is not itself a Workspace. |
| **P9** | Do not collapse Identity, Workspace, Organization, and Tenant. |
| **P10** | Multi-Workspace membership/switching is **not** a current V2 Product requirement and must not be implemented or assumed. It may be reconsidered later. |

Existing GoGoX/Pulse customers should use the **same Pulse identity/account** when accessing V2, rather than a separate V2 customer identity. That is identity continuity, not shared infrastructure.

---

## Validation

| Source | Result |
|--------|--------|
| ADR-013 | **Compatible.** Identity continuity is Product; Auth planes stay split. |
| `02-identity.md` | **Compatible.** Law #6: Identity authenticates; Workspace/RBAC are downstream. |
| `03-workspace.md` | **Compatible, not a V2 law.** Production Current State includes `switchWorkspace()` and a policy-gated switcher. That is production implementation, not a requirement that V2 ship multi-Workspace switching. |
| Identity Authorization Design | **Compatible.** `membershipId` remains a selector that must be verified; V2 Product does not require a client Workspace picker. If an Actor has one membership, that is the session context. |
| Identity Gate | **Compatible.** Caller `workspaceId` never authority. |
| ADR-005 / Layer 1 | **Compatible.** Workspace = operating/data boundary. |

No frozen Layer 1 source requires “one user → many Workspaces” as a V2 Product law. No frozen Layer 1 source forbids a person ever having another Workspace later.

---

## Explicitly not decided (not Gate B)

V2 Auth architecture; production/V2 federation or broker; account linking; Auth provider; `auth.users`; Person vs Auth user; membership/RBAC schema; permission catalog freeze; RLS; Tenant; Organization → Workspace mapping; Hono; V2 infrastructure; local vs hosted; Slice 4.

**Next gate when asked:** Gate C — Infrastructure (not started by this ADR).
