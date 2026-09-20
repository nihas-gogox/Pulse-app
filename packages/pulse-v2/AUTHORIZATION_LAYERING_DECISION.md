# Pulse V2 — Authorization Layering Decision

**Kind:** Owner confirmation + operation mapping. Documentation only.  
**Does not authorize:** RBAC runtime, Capability checks, Auth, RLS, Slice 5.  
**Runtime:** `a60aad5a` **FROZEN**. Vocabulary inventory: `1414a844`. OPEN B: `756b8fc7`. OPEN A: `5abe24f1`.

---

## 1. Owner decision

### AUTHORIZATION LAYERING — CONFIRMED

### OPERATION MAPPING — PARTIALLY OPEN

Owner confirms:

> V2 uses **Membership.active** for Workspace access, **Capability** for Product/Experience feature gating, and **PlatformPermission** for Workspace administrative/delegation authorization. Gateway **`domain + operation` remains an invocation key**, not a permission catalog.

Confirmed constraints:

- No fourth permission catalog  
- Role is Membership-scoped; **role names remain unfrozen**  
- Actor existence never grants authorization  
- Membership.active is required for Workspace access  
- Capability is evaluated **only after** trusted Workspace authorization  
- PlatformPermission is **only** for defined Workspace admin/delegation  
- `@pulse/contracts` `Permission` remains **Hono Identity HTTP-only** unless separately in-scoped  
- `06-permissions.md` is **not** V2 source of truth  
- JWT role is **not** V2 Membership Role authority  
- Client-derived capability is **not** authorization authority  
- Analytics `AdminPermission` is **not** V2 authorization authority  
- `organization_members.permissions` JSON is **not** the V2 authorization schema  

The three vocabularies are **not a stack**. They answer **different questions**. No precedence or inheritance among them unless a later decision says so.

---

## 2. Three-way authorization model

```text
                  ┌─────────────────────┐
                  │ Membership.active   │
                  │ Workspace access    │
                  └──────────┬──────────┘
                             │
                             ▼
                   Trusted Workspace
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        ┌──────────────┐          ┌─────────────────┐
        │ Capability   │          │ Platform        │
        │ Product /    │          │ Permission      │
        │ Experience   │          │ Admin /         │
        │ gating       │          │ delegation      │
        └──────────────┘          └─────────────────┘
```

Plus (OPEN B Option C): **domain** entity + business-state. Not a fourth catalog.

---

## 3. Membership.active

**Question:** May this Actor operate in this Workspace **right now**?

**Authority:** Pulse Identity Membership status `active` (Slice 4). Suspended/revoked/absent → deny. First-login Actor **without** Membership → no Workspace, no data-plane.

**Already implemented** on every public `execute()`.

---

## 4. Capability

**Question:** After Workspace is trusted, is this **Product/Experience capability** available in this context?

**Vocabulary:** existing `lib/capabilities.ts` (`fleet_management`, `dispatch`, `dispatch_for_own_fleet`, `marketplace_post`, `marketplace_bid`, `finance_view`, `finance_manage`, `team_manage`).

**Not:** a Gateway permission enum; not client `getCapabilitiesFromProfile()` as SoT; not operating-model replacement for Membership.

**Do not invent** new Capability values for V2 operations.

---

## 5. PlatformPermission

**Question:** May this Membership perform **Workspace administration / delegation**?

**Vocabulary:** `members.invite|remove|view`, `organization.settings|archive`, `identity.policy.edit`, `sso.configure`, `billing.manage`.

**Not** for ordinary Commerce/Execution business operations.

---

## 6. Gateway `domain + operation`

Identifies the **attempted invocation**. Not a permission catalog. Not mapped to `@pulse/contracts` `Permission`.

Current V2 domains: `commerce` | `execution` only.

---

## 7. Role placement

```text
Actor
  ↓
Membership
  ├── Workspace
  ├── active | suspended | revoked
  └── Role   ← names OPEN
```

Role is **not** on Actor, Auth Subject, Workspace, or Product. Do **not** freeze `admin|planner|operator` (or production `PlatformTeamRole`) as V2.

---

## 8. AuthorizationContext relationship

Runtime context remains `{ actorId, membershipId, workspaceId, correlationId }`.

It does **not** carry Capability or PlatformPermission lists. Those are evaluated (when implemented) from trusted Membership/Workspace **SoT**, never from payload `role` / `permissions` / `capabilities`.

Empty/absent grants **must not** mean allow-all. Operation-level checks, once enabled, fail closed.

---

## 9. Domain / business authorization boundary

Gateway: identity, Membership/Workspace, coarse Capability / PlatformPermission **where mapped**.

Domain: entity in trusted Workspace; business-state (duplicate trip, invalid id, not found).

Do **not** encode “order already placed / trip already created” as Capability or PlatformPermission.

---

## 10. Gateway operation mapping

**Source of operations:** `handleCommerceOperation`, `handleExecutionOperation` only.  
There is **no** `execution.createTrip` or `execution.dispatch` in `@pulse/v2`.

**Legend**

- Workspace gate = Membership.active (always for public `execute()`)  
- Capability = existing Capability **or UNMAPPED** (do not invent)  
- PlatformPermission = existing admin permission **or N/A**  
- Domain = entity/workspace scoping and/or business-state **already in handlers**

| Domain | Operation | Class | Workspace gate | Capability | PlatformPermission | Domain authorization |
|--------|-----------|-------|----------------|------------|--------------------|----------------------|
| commerce | `createOrder` | **E** (+ Capability **UNMAPPED**) | Membership.active | **UNMAPPED — OWNER** | **N/A** | Yes: `id` required; persist `authz.workspaceId`; nested `createTripFromOrder` same context |
| commerce | `getOrder` | **E** (+ Capability **UNMAPPED**) | Membership.active | **UNMAPPED — OWNER** | **N/A** | Yes: row must exist in trusted Workspace (`COMMERCE_NOT_FOUND` otherwise) |
| execution | `createTripFromOrder` | **E** (+ Capability **UNMAPPED**) | Membership.active (nested: **same ctx**, no second membership lookup) | **UNMAPPED — OWNER** | **N/A** | Yes: `orderId` required; idempotent existing trip; persist trusted Workspace |
| execution | `getTrip` | **E** (+ Capability **UNMAPPED**) | Membership.active | **UNMAPPED — OWNER** | **N/A** | Yes: row in trusted Workspace |

**Why Capability is UNMAPPED:** No existing Capability means “sales order” / V2 Commerce. `dispatch` is production **indents, trips, assign drivers/vehicles** — using it for `createOrder` or `createTripFromOrder` would be convenience, not evidence. `finance_*` / `marketplace_*` / `team_manage` / `fleet_management` do not describe these operations.

**Why PlatformPermission is N/A:** None of the four operations are invite/SSO/billing/org archive/settings.

**Why class E:** Each operation already depends on **domain** validation and Workspace-scoped persistence, not Membership.active alone as the only check.

**Not mapped to contracts `Permission`.**

---

## 11. Unmapped operations

| Item | Status |
|------|--------|
| Capability for all four current V2 operations | **UNMAPPED — OWNER DECISION REQUIRED** |
| Any operation not listed in §10 | **Does not exist** — do not invent |
| Hono `Permission` for V2 Gateway | **Out of scope** unless Owner in-scopes |

Do **not** implement Capability or PlatformPermission checks on these operations until Capability mapping is decided **or** Owner explicitly keeps them at Membership.active + domain only.

---

## 12. Historical / deprecated (V2 authorization)

- Fourth catalog / Gateway operation-as-permission  
- JWT role as V2 Membership Role  
- Client-derived Capability as authority  
- `06-permissions.md` as SoT  
- Analytics `AdminPermission`  
- `organization_members.permissions` as V2 schema  
- contracts `Permission` as V2 Gateway catalog  

---

## 13. Security invariants

Caller `actorId`, `membershipId`, `workspaceId`, `role`, `permissions`, `capabilities` are **claims only**.

Workspace authority = verified Membership. Nested Commerce→Execution = **same** AuthorizationContext. Deny by default. Actor ≠ allow.

---

## 14. Explicit non-decisions

- Role names  
- Which Capability (if any) attaches to current V2 operations  
- In-scoping contracts `Permission`  
- Freezing `06-permissions.md`  
- Auth, Membership SQL, RLS, JWT, hosted V2, Slice 5  
- Implementing any mapping  

---

## 15. Implementation prerequisites

1. This layering confirmation (done).  
2. Owner: Capability mapping for current operations **or** explicit “membership + domain only until Product gating exists.”  
3. Only then: Gateway coarse checks — still no new catalog.

---

*No runtime, contracts, production, or test files were modified.*
