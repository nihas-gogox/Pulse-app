# Pulse V2 — Identity Gate: Formal Decision & Approval Record

**Record type:** Architecture decision record (this document).  
**Design artifact:** `IDENTITY_AUTHORIZATION_DESIGN.md` (Slice 3, DESIGN ACCEPTED).  
**This record does not implement Identity.** Zero application code, zero V2 runtime code, zero RLS, zero migrations, zero Hono wiring, zero production changes, zero hosted provisioning.

**Who this record can approve:** Architecture invariants explicitly adopted below.  
**Who this record cannot approve:** Product/Business, Security (implementation/provisioning), or Infrastructure owners. Those remain **OPEN — OWNER REQUIRED** even where Architecture recommends a direction.

Production-feedback quality contract (blast radius, financial truth, boot, query budgets): `PULSE_V2_QUALITY_CHARTER.md`. It does not reopen this gate or authorize Slice 4.

Status vocabulary:

| Label | Meaning |
|-------|---------|
| **APPROVED** | Frozen by this Architecture record; safe to treat as invariant |
| **APPROVED WITH CONDITION** | Direction frozen; a named condition or other owner still blocks implementation |
| **OPEN — OWNER REQUIRED** | Must not be answered by the coding agent or treated as settled |
| **BLOCKED** | Work that depends on this item must not start |

---

## 1. Decision 1 — Workspace Model

**Status:** **APPROVED** (entity) · **OPEN — OWNER REQUIRED** (mapping keys)

**APPROVED:** Workspace is an explicit V2 Identity entity representing the Layer 1 operating boundary.

Do **not** equate:

```text
Workspace = Organization
Workspace = Tenant
```

Instead:

```text
V2 Workspace
    ↓
documented mapping
    ↓
existing Organization
```

The mapping is an **integration/cutover relationship**, not the definition of Workspace.

### Frozen invariants

1. Workspace owns business data.
2. Workspace is the authorization boundary for V2 business data.
3. Tenant may exist above Workspace in the future.
4. Tenant must not replace Workspace as the business-data ownership boundary.
5. V2 must not query production `public.organizations` to establish runtime authorization.

### Still OPEN — Product/Business + Architecture

- Exact mapping key
- UUID vs code
- Whether the first V2 customer is 1:1 Organization → Workspace
- Whether a holding-company Tenant exists in the first V2 customer

---

## 2. Decision 2 — Authentication Model

**Status:** **APPROVED** (isolation default + membership authority) · **OPEN — OWNER REQUIRED** (one-login / federation requirement)

**APPROVED:** V2-owned authentication is the default isolation model.

**APPROVED:** Membership authority always remains Pulse V2 Identity.

Authentication authority and membership authority are separate:

```text
Authentication
    ↓
Actor
    ↓
V2 Membership
    ↓
Workspace
```

### Explicitly rejected as default

Production Supabase Auth must **not** become a runtime V2 dependency.

Not allowed as the normal authorization path:

```text
V2 → production auth.users
V2 → production organization_members
```

### Federation (future option, not default)

If Product later requires existing GoGoX users to use the same login for V2, that must be an **explicitly approved broker/federation architecture**, not V2 reading production databases.

### Product — Gate B (2026-09-20)

**CLOSED (revised):** one Pulse identity across platform and services, including V2; **one authorized Workspace context** per V2 session (ADR-014). No V2 Workspace switcher. One identity does **not** imply global access. Multi-Workspace switching is deferred.

**Still OPEN (not Gate B):** how identity continuity is implemented (federation/broker vs other Architecture/Security designs). Must not be “V2 reads production Auth/DB.”

---

## 3. Decision 3 — Trusted Authorization Context

**Status:** **APPROVED**

**Frozen security invariant:** Caller-supplied `workspaceId` is never authorization authority.

The only valid source of trusted workspace authority:

```text
Authenticated Actor
      ↓
verified V2 Membership
      ↓
trusted Workspace
```

`membershipId` may be supplied as a **selector**. It must then be verified against the authenticated Actor.

Conceptual context (not implemented in this gate):

```text
AuthorizationContext {
    actorId
    workspaceId
    membershipId
    roles
    permissions
    correlationId
}
```

### Frozen rules

- Domain handlers must not trust arbitrary workspace IDs.
- Repository access must operate from trusted authorization context.
- Membership is the source of truth for workspace access.
- Role belongs to Membership.
- Permissions are resolved by authorization logic.
- Client payload cannot grant tenancy.

---

## 4. Decision 4 — RLS Direction

**Status:** **APPROVED** (principle) · **OPEN — OWNER REQUIRED** (plumbing)

**APPROVED:** RLS remains deny-all until V2 authentication and membership are actually available.

Future RLS must consume **server-verified** identity and workspace context. It must never trust:

```text
payload.workspaceId
client-set GUC
client-provided role
client-provided permission
```

Conceptual target:

```text
V2 Auth
   ↓
verified Actor
   ↓
verified Membership
   ↓
trusted Workspace
   ↓
RLS
```

Permissions remain out of JWTs unless a future explicit architecture decision changes the frozen JWT rule.

**Not frozen:** exact mechanism (Supabase Auth claims vs membership lookup vs trusted DB/session context vs hybrid). That depends on the actual V2 Auth implementation design.

---

## 5. Decision 5 — Permission Model

**Status:** **APPROVED** (no fourth catalog; conceptual mapping shape) · **OPEN — OWNER REQUIRED** (final mapping + `06-permissions.md` freeze)

**APPROVED:** No fourth permission catalog will be created.

Preserve distinctions:

```text
Role
Permission
Capability
Policy
Product Entitlement
Operation
```

Minimum mapping shape (not an enum, not implemented):

```text
Membership Role
        ↓
Platform/admin permissions

Workspace/Product policy
        ↓
Product capabilities

Product activation
        ↓
Product entitlement

Gateway operation
        ↓
Authorization check using the above
```

`06-permissions.md` must be frozen before production-grade V2 authorization rules are implemented.

### Still OPEN — Product/Business + Architecture

Final mapping and freeze of permission boundaries. Do not invent a new enum in V2.

---

## 6. Decision 6 — Hono vs Gateway

**Status:** **APPROVED** (Gateway-first, Hono dormant) · **OPEN — OWNER REQUIRED** (eventual port/extract)

**APPROVED:** Gateway-first, Hono-later.

Day 1:

```text
Client
  ↓
V2 Gateway
  ↓
Identity/authentication dependency
  ↓
AuthorizationContext
  ↓
Domain
```

Hono is **not** wired now. The existing Hono implementation is not the V2 identity system merely because it exists.

If Hono is eventually reused, it must:

- run against dedicated V2 infrastructure
- use V2 migrations
- not point at production `platform.*`
- not leak its service-role pattern into domain adapters
- reconcile its JWT contract with the approved V2 identity model

Whether Hono is eventually ported or extracted remains an Architecture decision **after** the identity contract exists.

---

## 7. Decision 7 — Dedicated V2 Infrastructure

**Status:** **Gate C CLOSED (ADR-015)** — local V2-only for the current phase. Hosted provisioning remains **not authorized**.

**APPROVED (current phase):** Isolated V2 data plane = memory or **local** Supabase/Postgres + V2 migration tree. That is sufficient to proceed with architecture validation; it does **not** authorize Identity table creation or Slice 4 by itself.

The coding agent must **not** provision hosted V2.

**Current-phase boundary (ADR-015):** V2 = memory or local Supabase; never production. Hosted V2 remains a future option.

`packages/pulse-v2/supabase/migrations` remains the V2 migration tree.  
`supabase/migrations` remains production-only.

### Later (not this phase)

Hosted V2 project, hosted Auth, backup/PITR/DR, operational controls — **not provisioned**, not authorized by Gate C.

---

## Final Identity Gate status

| Area                                 | Decision | Status | Owner |
| ------------------------------------ | -------- | ------ | ----- |
| Workspace = explicit V2 entity       | Layer 1 operating/data boundary; not Organization; not Tenant | **APPROVED** | Architecture |
| Organization → Workspace mapping     | Cutover/integration mapping only; keys, UUID vs code, first-customer 1:1, holding-company Tenant | **OPEN — OWNER REQUIRED** | Product/Business + Architecture |
| V2-owned authentication default      | Isolation-first Auth; production Auth is not a runtime dependency | **APPROVED** | Architecture |
| Existing-user / one Pulse identity | One identity across services including V2; one authorized Workspace context per V2 session (ADR-014) | **APPROVED** (Product, Gate B) | Product/Business |
| Membership authority                 | Always Pulse V2 Identity, independent of Auth provider | **APPROVED** | Architecture |
| Trusted workspace authority          | Verified Actor → Membership → Workspace; caller `workspaceId` never authority | **APPROVED** | Architecture |
| RLS principle                        | Deny-all until trusted Auth + membership exist; never trust payload/GUC/client role | **APPROVED** | Architecture |
| Exact RLS plumbing                   | Claims vs lookup vs session GUC vs hybrid | **OPEN — OWNER REQUIRED** | Architecture + Security |
| Permission catalog mapping           | No fourth catalog; map Role / Permission / Capability / Policy / Entitlement / Operation | **OPEN — OWNER REQUIRED** | Product/Business + Architecture |
| `06-permissions.md` freeze           | Required before production-grade V2 authorization rules | **OPEN — OWNER REQUIRED** | Product/Business + Architecture |
| Gateway-first                        | Day-1 authorization boundary; Identity is a dependency of Gateway | **APPROVED** | Architecture |
| Hono future role                     | Dormant now; port/extract only after contract + V2 infra; not identity-by-existence | **OPEN — OWNER REQUIRED** | Architecture |
| Dedicated V2 infrastructure          | Current phase: local V2-only (ADR-015); hosted not provisioned | **APPROVED** (local posture) | Infrastructure |
| V2 Auth provisioning                 | Not in Gate C; local Auth allowed later if Identity is authorized; hosted Auth not provisioned | **OPEN** (implementation) | Architecture + Security |

---

## Frozen vs open

### Frozen (safe now)

1. Workspace is the V2 operating/data boundary.
2. Workspace is not silently synonymous with Tenant.
3. Caller `workspaceId` is never authority.
4. Membership establishes Workspace authority.
5. Membership belongs to V2 Identity.
6. Production identity is not a V2 runtime dependency.
7. RLS remains deny-all until trusted identity exists.
8. No fourth permission catalog.
9. Gateway is the Day-1 authorization boundary.
10. Hono remains dormant.
11. Dedicated V2 infrastructure precedes real Auth/RLS wiring.

### Must remain open (not implementation tasks)

- Organization → Workspace mapping keys
- Holding-company Tenant decision
- How one Pulse identity is implemented across production vs V2 Auth (federation/broker — not Gate B)
- V2 Auth vs eventual federation details
- Person vs `auth.users` model
- Exact RLS claim/session mechanism
- Permission catalog final mapping
- `06-permissions.md` freeze
- Hono implementation/extraction decision
- Dedicated V2 infrastructure provisioning
- Backup/PITR/DR requirements

---

## Slice 4 gate

**BLOCKED** until the owner-required decisions are explicitly approved by the named owners **and** dedicated V2 infrastructure is approved/provisioned for real Auth/RLS work.

This Architecture record does **not** substitute for Product, Security, or Infrastructure approval.

## Slice 4 authorization design (2026-09-20)

**DESIGN ONLY** — `SLICE_4_AUTHORIZATION_DESIGN.md`. Implementation **not** authorized. Trusted path: Actor → verified Membership → Workspace → AuthorizationContext (Gateway). Payload `workspaceId` is never authority.

