# Pulse V2 — Identity `createWorkspace` Contract

**Kind:** Contract design only. No implementation.  
**Closes:** next gate from `WORKSPACE_CREATION_AUTHORITY_DESIGN.md` (`7648c5bd`).  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Executive contract decision

### DESIGN COMPLETE

Identity-owned operation:

```text
Identity.createWorkspace
```

```text
Trusted Actor (OPEN A bind; not request.actorId)
        ↓
Identity.createWorkspace
        ↓
Workspace (Identity-issued id)
  + exactly one Membership { actor = trusted Actor, workspace = new, status = active, Role OPEN }
        ↓
Success result (Identity-owned; not Gateway AuthorizationContext)
```

This is an **Identity bootstrap command**, not a Workspace data-plane operation. It does **not** require `Membership.active`. After success, data-plane `execute()` still requires `Membership.active`.

**Caller request payload has no required fields.** Authorization comes only from the trusted Actor established by Identity bind.

---

## 2. Ownership

| Concern | Owner |
|---------|--------|
| Workspace creation | **Pulse Identity** |
| First Membership creation, activation, initial Role assignment | **Pulse Identity** |
| Auth Subject → Actor bind | Pulse Identity (OPEN A) |
| `AuthorizationContext` | **V2 Gateway** (after membership verify) |
| Commerce / Execution / Finance / Network / Product / UI | **Must not** create Workspace or Membership |

Gateway may **invoke** the operation later. Gateway does **not** own Workspace or Membership writes.

Current runtime (`IdentityPort`): `resolveActor` + `resolveMembership` only. **`createWorkspace` is not implemented.**

---

## 3. Trusted Actor input

Distinguish:

| Layer | Contents | Authority? |
|-------|----------|------------|
| **Trusted execution context** | `actorId` from `IdentityPort.resolveActor(IdentityProof)` | **Yes** — only Actor authority |
| **Caller-provided request data** | Optional metadata later; **none required now** | **No** |

**Forbidden as authorization authority** on the create request (and ignored as authority if present):

```text
actorId, workspaceId, membershipId, role, permissions, capabilities
```

If `request.actorId` is supplied on a future Gateway invocation and ≠ trusted Actor → existing **`V2_ACTOR_DENIED`** (SEC-001). Do not pass caller `actorId` into Identity as the creating Actor.

Proof remains OPEN A: opaque `IdentityProof`; Gateway must not treat proof value as Actor id.

---

## 4. Bootstrap context

**Before**

```text
Actor + no Membership + no Workspace context
→ data-plane execute() denies (V2_MEMBERSHIP_DENIED)
```

**During** — Identity bootstrap (this contract)

```text
Trusted Actor → Identity.createWorkspace → Workspace + first Membership.active
```

**After**

```text
Actor → active Membership → Workspace
→ Gateway may construct AuthorizationContext on a later execute()
```

This **does not violate** OPEN B / Slice 4: **data-plane domain operations still require `Membership.active`**. Create Workspace is **not** Commerce/Execution.

`V2DomainName` today is only `"commerce" | "execution"`. Identity is **not** a current Gateway domain. Do not smuggle create into those domains.

---

## 5. Request shape

### Trusted execution context (not payload)

| Field | Required | Owner | Validation | Affects authorization? | Persisted? |
|-------|----------|-------|------------|------------------------|------------|
| `actorId` | Yes | Identity (`resolveActor`) | Actor must exist | **Yes** (creating Actor) | Membership.actorId |
| `correlationId` | Yes | Caller / Gateway (existing `execute()` rule) | Non-empty string | No | Observability only |

### Caller-provided request body

**Empty.** No required Workspace metadata.

Previous authority gate: display name **may** exist later as Identity metadata, **not** authorization. **Not in this contract.** Do not require name, type, billing, Product, Organization, Tenant, or Role.

### Explicitly rejected request fields (authority)

| Field | If present |
|-------|------------|
| `workspaceId` | **Deny** — not Identity-issued create; **not** join existing Workspace (`V2_WORKSPACE_DENIED` semantics) |
| `actorId` as create target | **Deny** as authority; mismatch vs trusted Actor → `V2_ACTOR_DENIED` |
| `membershipId` | **Deny** as create input — Identity issues Membership id |
| `role` / `permissions` / `capabilities` | **Deny** as authority — no self-escalation |

Conceptual signature (not runtime):

```text
Identity.createWorkspace(
  context: { actorId: TrustedActorId, correlationId: string }
)
```

---

## 6. Response shape

**Identity-owned result.** Do **not** return `AuthorizationContext` (Gateway-only, after `resolveMembership` on a **later** data-plane call).

### Success

| Field | Meaning |
|-------|---------|
| `ok` | `true` |
| `workspaceId` | Identity-issued Workspace id |
| `membershipId` | Identity-issued first Membership id |
| `actorId` | Trusted creating Actor (echo of context, not caller authority) |
| `membershipStatus` | `"active"` |
| `correlationId` | Same as trusted context |

**Omit `role` from the response** until Role names are frozen (clients must not depend on a string). Role is still **assigned internally** on Membership.

**Omit** Product, Capability, PlatformPermission, Organization, Tenant.

### Failure

Existing Gateway error shape: `{ ok: false, code, message, correlationId }`. Identity create uses the **same** `V2_*` code convention; do not invent a parallel error bus.

---

## 7. Workspace ID semantics

```text
Workspace ID = Identity-issued on successful createWorkspace
```

Caller cannot establish authorization with an existing Workspace id. Response **exposes** the new `workspaceId` so a later `execute()` can use **membership selector** (`membershipId`), not payload `workspaceId` as authority.

ID format (UUID vs other) is **not** decided here. Persistence is **not** decided here.

---

## 8. First Membership semantics

On success, Identity creates **exactly one** Membership:

| Fact | Value |
|------|--------|
| `actorId` | Trusted Actor only |
| `workspaceId` | Newly created Workspace only |
| `status` | `active` |
| Role | Assigned by Identity; **names OPEN** |
| `membershipId` | Identity-issued |

Not created from caller `workspaceId` or caller Actor identity. Not for Actor B. Uniqueness remains **one Membership per (`actorId`, `workspaceId`)** (`MEMBERSHIP_PROVISIONING_DESIGN.md`).

Actor creation still does **not** create Membership (OPEN A).

---

## 9. Role semantics

Caller **does not** choose Role. Identity assigns the initial Role at Membership creation.

**Initial Role = OWNER-DEFINED / OPEN.** Do not freeze `admin` / `planner` / `operator` / `owner`.

No `ROLE_INVALID` on this contract: Role is not caller input.

---

## 10. Atomicity

```text
Success: Workspace exists AND first Membership.active exists for the creating Actor
Failure: neither is an authorized V2 Workspace state
```

Partial persistence (`Workspace` without Membership, or Membership without Workspace) is **not** a successful outcome. If an implementation could write one without the other, it **must not** expose success; recovery of orphans is **not** defined.

Database transactions / engine: **not** this contract.

---

## 11. Error semantics

Reuse existing Slice 4 / Gateway codes. **Do not** invent categories without convention.

| Code | When | Domain invoked? |
|------|------|-----------------|
| `V2_UNAUTHENTICATED` | No trusted Actor (`resolveActor` fail) | No |
| `V2_ACTOR_DENIED` | Caller `actorId` ≠ trusted Actor | No |
| `V2_GATEWAY_INVALID` | Missing `correlationId` if invoked via Gateway | No |
| `V2_WORKSPACE_DENIED` | Caller supplied `workspaceId` (or equivalent) as authority | No |
| `V2_WORKSPACE_CREATE_FAILED` | Atomic Workspace+Membership unit failed | No (no authorized Workspace) |

**Omitted (not justified now):**

- `WORKSPACE_CREATION_DENIED` — any authenticated Actor **may** create; no PlatformPermission deny path
- `MEMBERSHIP_CREATION_FAILED` as a distinct success-adjacent code — folded into `V2_WORKSPACE_CREATE_FAILED` (atomicity)
- `ROLE_INVALID` — Role not caller-supplied
- `INVALID_REQUEST` as a new code — use `V2_GATEWAY_INVALID` / `V2_WORKSPACE_DENIED`

Authorization failure **must not** become a successful Workspace.

---

## 12. Authorization

```text
Authenticated Actor (Identity bind)
        ↓
Identity.createWorkspace
```

**Not required:** existing Membership, PlatformPermission, Capability, Product entitlement, existing Workspace, production Organization membership.

Authentication must succeed **before** Identity treats the Actor as trusted. Authentication **alone** still does not create a Workspace.

---

## 13. Self-join protection

This contract **cannot** mean:

```text
createWorkspace(workspaceId = existingWorkspace)
createWorkspace(actorId = anotherActor)
createWorkspace(role = privilegedRole)
```

Those inputs are not Identity-issued grants. Workspace and Membership identities are established **only** by Identity.

---

## 14. Product / Capability relationship

**NONE.** Create does not create Product entitlement, Capability, Product Membership, Commerce/Execution access, or Product activation.

---

## 15. PlatformPermission relationship

**NONE.** Do not add `workspace.create`. `members.invite` remains **after** a Workspace exists.

---

## 16. IdentityPort relationship

Today:

```text
IdentityPort.resolveActor
IdentityPort.resolveMembership
```

**Future conceptual façade (not implemented):**

```text
IdentityPort.createWorkspace(context: { actorId, correlationId })
```

Implemented **behind** the Identity boundary (Identity application command). Gateway already depends on `IdentityPort`; a second Identity client is **not** required.

Do **not** add this method until a later implementation gate. Resolve methods stay **read**; create is a **write** on the same port, not a Commerce API.

---

## 17. Gateway relationship

```text
Authenticated request
        ↓
resolveActor → trusted Actor
        ↓
[bootstrap path — NOT current execute()]
        ↓
Identity.createWorkspace(trusted Actor, correlationId)
        ↓
Workspace + first Membership
        ↓
later public execute(): resolveActor + resolveMembership → AuthorizationContext
```

| Question | Answer |
|----------|--------|
| Does Gateway own create? | **No.** Identity owns writes. |
| Is Gateway the invocation boundary? | **May be**, via a **bootstrap** entry distinct from data-plane `execute()`. Current `execute()` **always** `resolveMembership` and cannot create the first Workspace. |
| Trusted context passed? | Trusted `actorId` + `correlationId` only. |
| AuthorizationContext during create? | **Does not exist yet.** Must not be required. |

**OPEN for a later gate:** exact Gateway vs Identity-only entrypoint (method name, whether `identity` becomes a `V2DomainName`). Not decided here.

---

## 18. Idempotency / retry

Frozen Command Envelope v1 includes `idempotencyKey` and **requires `tenantId`**. At create time there is **no** Workspace to map as `tenantId`. Therefore **`createWorkspace` is not a CommandEnvelope v1 write as currently frozen.** Do not invent a second envelope.

Retries without an Identity-owned idempotency rule **can** create **two** Workspaces (multiple Workspaces per Actor are allowed in data). That is **not** the intent of a retried single create.

**Implementation prerequisite (not a request field in this contract):** before runtime, bind this Identity command to the **existing** `idempotencyKey` convention (Command Envelope field, not a new key type), with bootstrap `tenantId` **not** used as Workspace authority (mapping remains Quality Charter / Identity Authorization OPEN). Until that prerequisite is designed, do not ship retries as “safe.”

This contract **does not** add `idempotencyKey` to the request shape.

---

## 19. Correlation conventions

Use the **existing** Gateway `correlationId` (required on `execute()`). Do not invent a second correlation mechanism.

| `correlationId` | Role |
|-----------------|------|
| Request/execution metadata | **Yes** |
| Identity create payload authority | **No** |
| Generated internally if Gateway already supplied it | Pass through; Identity does not mint a second id |

Command/event envelope `correlationId` remains the frozen field if a future event is emitted. Do not redesign the envelope.

---

## 20. Consistency boundary

**In:** Workspace creation + first Membership creation (one Identity operation).

**Out:** Product, Commerce, Execution, Finance, Analytics, Organization, Tenant, external systems.

No cross-domain distributed transaction.

---

## 21. Event relationship

No `WorkspaceCreated` (or equivalent) exists in `packages/pulse-v2` or `packages/contracts` event catalogs searched for this gate.

**Potential future requirement only:** emit a Workspace-created event **after** atomic success, using the **existing** event envelope; `tenantId` on that event **may** then equal the new Workspace id. **Do not** create an event now. **Do not** redesign the envelope.

---

## 22. Security invariants

| ID | Invariant |
|----|-----------|
| S1 | Only a trusted authenticated Actor may invoke |
| S2 | Actor identity is not caller-controlled |
| S3 | Workspace ID is Identity-issued |
| S4 | Caller cannot self-join via existing Workspace id |
| S5 | Exactly one initial `active` Membership |
| S6 | That Membership belongs to the creating Actor |
| S7 | That Membership belongs to the newly created Workspace |
| S8 | Role cannot be self-escalated |
| S9 | No Product/Capability entitlement |
| S10 | No PlatformPermission required |
| S11 | Workspace + Membership succeed atomically |
| S12 | Failed operation does not produce an authorized partial Workspace |

---

## 23. Explicit non-decisions

Auth provider, JWT, session format, Workspace/Membership schema, migrations, RLS, hosted V2, production Identity, SSO, SCIM, final Role names, Product entitlement, Capability / PlatformPermission changes, service-to-service auth, microservice extraction, Gateway method name for bootstrap, CommandEnvelope `tenantId` bootstrap mapping, `idempotencyKey` request field, `WorkspaceCreated` event, display name, ID format.

---

## 24. Implementation prerequisites

Not authorized by this document:

1. `IdentityPort.createWorkspace` (or Identity command behind it)
2. Gateway **bootstrap** path that skips `resolveMembership`
3. Persistence / migrations / RLS
4. Idempotency design for bootstrap (existing `idempotencyKey`, not a new bus)
5. Optional future `WorkspaceCreated` event
6. Role name freeze

Slice 4 runtime remains frozen at `a60aad5a`.

---

## 25. Next gate

**Identity bootstrap invocation boundary** — whether Gateway exposes a non-data-plane entry that calls `Identity.createWorkspace` after `resolveActor` only, or Identity is invoked outside Gateway; still **no** tables, Auth, or runtime.

Not Slice 5. Not Role names. Not events.

---

### Validation

1 Actor creation ≠ Membership — **pass**  
2 Workspace create = first Membership path — **pass**  
3 Any authenticated Actor may create — **pass**  
4 No PlatformPermission — **pass**  
5 No Product/Capability — **pass**  
6 Role names OPEN — **pass**  
7 Caller cannot provide Workspace authority — **pass**  
8 Atomic Workspace + Membership — **pass**  
9 Bootstrap Identity-owned — **pass**  
10 Data-plane still requires Membership.active — **pass**  
11 No new event bus/envelope — **pass**  
12 No runtime changes — **pass** (docs only)  
13 Production untouched — **pass**
