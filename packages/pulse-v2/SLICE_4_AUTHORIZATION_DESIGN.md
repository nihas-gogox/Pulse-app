# Pulse V2 — Slice 4 Authorization Design

**Status:** DESIGN ONLY. Implementation **NOT AUTHORIZED**.  
**Gates:** A ADR-013 · B ADR-014 · C ADR-015 (local V2-only) — closed.  
**Does not:** create tables, migrations, Auth, RLS policies, Gateway runtime changes, or production changes.

This document is the Slice 4 **authorization boundary**. It does not reopen ADRs 013–015.

---

## 1. Objective

Establish an enforceable path:

```text
Identity → Actor → Membership → Workspace → AuthorizationContext
  → Product / Experience access → Module / Feature permissions
  → Domain operation → Workspace-scoped data
```

**Invariant:** the authenticated Actor never authorizes access by supplying a Workspace ID. Payload `workspaceId` is never proof. Trusted path:

```text
Actor → Verified Membership → Workspace → AuthorizationContext
```

Today’s Gateway `execute({ domain, operation, payload, correlationId })` still copies caller `workspaceId` into persistence (`V2TenantContext`). That is **Slice 2 scoping**, not this design. Slice 4 implementation, when authorized, must stop treating that field as authority.

---

## 2. Identity model

**Conceptual Identity (one model):** Person/Actor, Membership, Workspace, Role, Permission — Layer 1 + ADR-013. Production and V2 are **two deployments**, not two business Identity models.

**V2 Identity authority:** isolated V2 plane only (`v2_identity` fence; zero tables today). Must not query production `auth.users`, `organization_members`, or `public.organizations` for runtime authorization (ADR-013).

**Auth authority vs membership authority:** Auth proves the credential. Membership proves Workspace. Product (ADR-014) requires one customer identity **across services**; how that is federated is **not** Slice 4.

**Unresolved:** Auth provider internals; Person row vs Auth user; federation/broker (Gate B Product vs ADR-013 isolation).

---

## 3. Actor model

| Question | Design |
|----------|--------|
| What | Application principal performing the action |
| Canonical id | `actorId` (V2 Identity). Not a Workspace id |
| Auth | Credential yields an **Auth subject**. Mapping Auth subject → `actorId` is **OPEN** (must not assume `auth.users` is the application identity) |
| Lifecycle | Created when V2 Identity accepts a verified Auth subject (or bootstrap). Disabled/deleted with membership revocation independent of Auth expiry |
| Before Auth | No Actor; unauthenticated |
| Abstraction | Actor is **not** identical to “JWT blob”; it is the Identity record the Gateway authorizes |

**Who is the Actor?** The V2 Identity principal `actorId` bound to the current credential by a trusted V2 boundary — not by the client.

---

## 4. Membership model

Membership is the **only** Actor↔Workspace authorization relationship.

| Attribute | Design |
|-----------|--------|
| Identifier | `membershipId` |
| Actor | `actorId` (required) |
| Workspace | `workspaceId` (required) |
| Uniqueness | One membership per (`actorId`, `workspaceId`) |
| Status | `active` \| `suspended` \| `revoked` (and optional `pending` **only if** invitations are later required — **not required** for this model) |
| Role | Associated on the membership (not on Actor) |
| Permissions | **Not stored as a client-editable list.** Resolved at authorization time from role (+ later Workspace/Product policy). Not a fourth catalog |
| Revocation | Status → `revoked` or `suspended`. Immediate: Gateway must re-read membership (or equivalent SoT) rather than trusting a stale token claim for Workspace access |
| Invitations | **Not required** for Slice 4 design. Deferred |

**How does the system prove the Actor is authorized for the Workspace?** Load membership for this `actorId` (and optional `membershipId` selector). It must exist, be `active`, and its `workspaceId` is the only trusted Workspace.

Selector: request **may** name `membershipId`. It must belong to this Actor and be `active`. It cannot mint access.

---

## 5. Workspace model

Workspace is the operating, authorization, and data boundary (ADR-014, `03-workspace.md` Principle, ADR-005).

Workspace is **not** Identity, Actor, Auth account, Organization, or Tenant.

Slice 4 needs: `workspaceId`, active/inactive (or equivalent), owned business data (`workspace_id` on domain rows).

**How does Workspace become the boundary?** After membership verification, `AuthorizationContext.workspaceId` **equals** `membership.workspaceId`. Persistence and future RLS use that id only.

**Deferred:** Organization → Workspace mapping, Tenant, production cutover.

**Product (current V2):** one authorized Workspace **context per session**. Multi-Workspace **switching UX is not required**. Architecture does **not** forbid a person having another membership later (fixtures already need many Actor×Workspace rows).

---

## 6. AuthorizationContext

Constructed **only** by the V2 Gateway (trusted boundary). Never assembled by the client.

| Field | Kind |
|-------|------|
| `actorId` | Authoritative (from Identity after Auth) |
| `membershipId` | Authoritative (verified row) |
| `workspaceId` | Authoritative (**from membership**, not payload) |
| `roles` | Derived from membership |
| `permissions` | Derived at Gateway authorize-time; may be empty until permission mapping exists; **never** copied from client or assumed complete in JWT |
| `correlationId` | Request-scoped (already required on `execute()`) |

Do not copy arbitrary Auth-token claims into this object.

If payload contains `workspaceId` and it **≠** trusted `workspaceId` → deny (escalation). If payload omits it → still use membership Workspace (one-context Product model).

---

## 7. Gateway responsibility

Day-1: existing **in-process** Gateway (`createPulseV2Gateway` / `execute()`). Not HTTP. Not Hono.

Target split (not implemented):

```text
Gateway
  ├── accept credential / trusted Actor proof (V2 Auth — not production)
  ├── resolve Actor
  ├── resolve/verify Membership (SoT lookup)
  ├── establish Workspace from membership
  ├── construct AuthorizationContext
  ├── authorize requested operation (platform + later product/RBAC)
  └── invoke domain handler(AuthorizationContext, payload)
```

Handlers and repositories receive **AuthorizationContext**. They must not take `workspaceId` as an independently trusted argument.

Frozen **Command Envelope v1** (`tenantId` required, from JWT, never invented): V2 `execute()` is **not** that envelope today. If/when commands are used, Gateway maps verified Workspace into envelope `tenantId` (or an **additive optional** Workspace field if later ADR’d). Do **not** remove frozen fields. Do **not** treat envelope `tenantId` as a second RLS key beside membership Workspace. Event catalog: Slice 4 does not add events.

---

## 8. Domain responsibility

After Gateway, a domain **may assume** the request passed the authorization boundary and `ctx.workspaceId` is trusted for **this** request.

Domain still must:

- enforce business rules and valid transitions
- own only its tables (`v2_commerce` / `v2_execution` …)
- persist and read with `ctx.workspaceId` (Slice 2 scoping becomes trusted)
- not leak other workspaces’ rows

Domain must **not**: authenticate; query production Identity; invent Workspace authority; trust payload `workspaceId`; query another domain’s tables; receive service-role.

---

## 9. Product / Experience authorization

Do not collapse into one global check.

| Layer | Question |
|-------|----------|
| Platform | Can this Actor operate in this Workspace? (**membership `active`**) |
| Product access | Is this Product enabled for the Workspace? (Product Registry / activation — existing concept; not redesigned here) |
| Experience access | Is this Experience allowed for this Actor in this Workspace? |
| RBAC | May this Actor perform this **operation**? |
| Domain rule | Is the operation valid on this aggregate? |

```text
Actor → Membership → Workspace → Product access → Experience access
  → Permission → Domain business rule → Operation
```

Slice 4 can ship the first two layers (Actor/Membership/Workspace/context) **without** freezing Product Registry or `06-permissions.md`.

---

## 10. Permission model dependency

**No fourth catalog.** Existing vocabularies remain: `06-permissions.md` (**not frozen**), `PlatformPermission`, `lib/capabilities.ts`, `@pulse/contracts` `Permission`.

Slice 4 references **operations** on the Gateway (`commerce.createOrder`, …) checked against AuthorizationContext. Final mapping Role → Permission → Capability → Policy → Entitlement is an **explicit OPEN dependency** (Identity Gate). Until frozen, operation checks may be: membership `active` only (insufficient for production-grade RBAC) — must not pretend the catalog is done.

---

## 11. RLS architecture

Current: RLS enabled, **zero policies** → deny-all. Keep until V2 Auth + membership SoT exist (ADR-013/015: local plane).

Eventual:

```text
AuthorizationContext (Gateway)
  → server-verified identity (V2 Auth subject / actor)
  → membership proves workspace_id
  → RLS: row.workspace_id = trusted workspace (never payload)
```

**Reject:** client `SET LOCAL`; caller-controlled Workspace claims; production `auth.users` / `organization_members`; service-role in domain adapters or browser.

**Exact plumbing** (JWT custom claims vs membership join vs hybrid) remains **OPEN**. Must exist before policies other than deny-all: V2 Auth, membership table, Gateway-only context construction, no client GUC.

---

## 12. Service-role boundary

| Where | Allowed? |
|-------|----------|
| Browser / Expo / OMS client | **Never** |
| Domain adapters | **Never** (`PULSE_V2_SUPABASE_SERVICE_ROLE_KEY` must not be passed in) |
| Local migration tooling | Yes, local V2 only (ADR-015) |
| Future trusted Identity/Auth **server** path | Only if least-privilege and never leaked to domains |
| Production | **Never** for V2 |

---

## 13. Boot / session lifecycle

```text
App Boot
  → Session restore
  → Actor authentication (V2)
  → Membership resolution
  → Workspace resolution (one context)
  → AuthorizationContext
  → Authenticated data plane
  → Product / Experience
  → Domain UI
```

A matching route is **not** sufficient to render domain UI.

| Failure | Meaning |
|---------|---------|
| Session unavailable / expired | Unauthenticated |
| Actor unavailable | Authenticated credential with no V2 Actor |
| Membership unavailable | No `active` membership |
| Workspace unavailable / inactive | Membership Workspace not operable |
| Authorization denied | Operation/Product/RBAC fail |
| Domain unavailable | Handler/persistence error after authz |

**No membership:** deny; do not invent a Workspace.  
**Suspended / revoked:** deny.  
**Cannot resolve Workspace:** deny.  
**Multiple active memberships (fixtures / future):** without a **verified** `membershipId` selector → **fail closed** (do not pick one). No switcher UX. Not a permanent ban on multi-Workspace later.  
**Requested Workspace not authorized:** deny even if payload matches a real id.

---

## 14. Security invariants

| ID | Invariant |
|----|-----------|
| **S1** | Authentication identifies Actor. |
| **S2** | Membership authorizes the Workspace relationship. |
| **S3** | Workspace is the data/operating boundary. |
| **S4** | Caller-supplied Workspace ID is never authority. |
| **S5** | AuthorizationContext is trusted only if Gateway-constructed. |
| **S6** | Domains cannot query production Identity. |
| **S7** | Domains cannot query other domains’ tables. |
| **S8** | Browser/client cannot use service-role. |
| **S9** | RLS stays deny-all until the trusted V2 identity path exists. |
| **S10** | Permission checks do not replace domain business rules. |

---

## 15. Test scenarios (acceptance criteria — not implementation)

Fixtures, e.g.:

```text
Actor A → Workspace 1 → Admin
Actor B → Workspace 1 → Operations
Actor C → Workspace 2 → Admin
```

Must prove:

- A cannot access Workspace 2  
- B cannot perform A’s Admin-only action (once RBAC mapping exists; until then document as pending)  
- C cannot access Workspace 1  
- Changing payload `workspaceId` cannot escalate  
- Authorized Actor cannot read another Workspace’s domain rows  

Multiple Workspaces in **data** is required for tests; Product still uses one context **per session**.

---

## 16. Deferred decisions

Final Auth provider; exact Auth-subject ↔ `actorId`; Person entity; membership/RBAC **schema**; permission catalog freeze; RLS policy SQL; Organization → Workspace mapping; Tenant; federation/broker; account linking; Hono; hosted V2; production cutover; multi-Workspace switching UX; Command Envelope additive fields; Slice 4 **code**.

---

## 17. Slice 4 implementation boundary (when later authorized — not now)

Narrowest later slice: Gateway builds AuthorizationContext from V2 Actor + membership; reject payload Workspace as authority; repositories use `ctx` only; still local V2 (ADR-015); RLS may remain deny-all until Auth+membership exist.

**Out of scope even then unless separately authorized:** customer workflow, Commerce/Execution expansion, Hono, Kafka/Redis/K8s, production, federation.

---

## 18. Acceptance criteria (design)

| Question | Answer |
|----------|--------|
| Who is the Actor? | V2 `actorId` bound to the credential by V2 Identity. Auth-subject mapping OPEN. |
| How is Workspace membership proved? | Active membership row for that Actor (optional verified `membershipId` selector). |
| How is Workspace the boundary? | `ctx.workspaceId` = `membership.workspaceId`; domain rows and future RLS use that only. |
| Where is context constructed? | In-process Gateway only. |
| Where is authz enforced before domain? | Gateway, before `handleCommerceOperation` / `handleExecutionOperation`. |
| What may the domain trust? | Gateway `AuthorizationContext`; not payload tenancy. |
| How are Product/Experience separated from identity? | Membership first; Product/Experience/RBAC layers after; catalogs not frozen. |
| How is data isolation enforced? | Trusted `workspace_id` on reads/writes; deny-all RLS until identity path exists; tests for cross-workspace. |
| How is Workspace escalation prevented? | Payload `workspaceId` ignored as authority; mismatch with membership → deny. |
| What before RLS beyond deny-all? | V2 Auth, membership SoT, Gateway context, no client GUC, no production Identity. |
| How avoid production fan-out? | **One** membership resolution per `execute()` (or per session restore, refresh on revoke-sensitive ops). No org-wide member fan-out, no global cache invalidation, no Redis. Query budget: Quality Charter template; bound by `workspace_id` + `actorId`. `correlationId` on every call. |
| How prove cross-Workspace impossible? | Fixture matrix in §15. |

---

## Validation (no silent architecture change)

| Source | Result |
|--------|--------|
| ADR-005 / `03-workspace.md` | Workspace = operating/data boundary. Production switcher is Current State, not V2 Product. |
| ADR-013 | V2 Auth/membership on isolated plane; no production Identity runtime path. |
| ADR-014 | One identity; one session Workspace context; no switcher; RBAC in Workspace. |
| ADR-015 | Local/memory only; no hosted provisioning in this design. |
| Identity Authorization Design / Identity Gate | Selector vs authority; Gateway-first; Hono dormant; no fourth catalog. |
| Slice 1–2 | `execute()` only; `PULSE_V2_*`; domain table ownership; `V2TenantContext` labeled untrusted until this design is implemented. |
| Quality Charter | No new global query fan-out; query budget; no Redis. |
| Frozen Command Envelope | Not rewritten; `tenantId` mapped from verified context later, not from payload. |
| Event catalog | No new events in this design. |

**Contradiction:** none that block this **design**. Remaining OPEN items are listed in §16, not hidden.

**Design status:** **SLICE 4 DESIGN ACCEPTABLE — READY FOR OWNER REVIEW**  
**Implementation:** **NOT AUTHORIZED**
