# Pulse V2 — Identity Bootstrap Invocation Boundary

**Kind:** Architecture design only. No implementation.  
**Closes:** next gate from `IDENTITY_CREATE_WORKSPACE_CONTRACT.md` (`6b0c746f`).  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Status

### DESIGN COMPLETE

**Decision:** **Option A — distinct non-data-plane Gateway bootstrap entry.**

`Identity.createWorkspace` **enters the system through the V2 Gateway**, not as a public Identity application API, and **not** through data-plane `execute()`.

```text
Authenticated request
        ↓
Gateway bootstrap entry  (not execute())
        ↓
IdentityPort.resolveActor(IdentityProof)
        ↓
Identity.createWorkspace(trusted Actor, correlationId)
        ↓
Workspace + first Membership.active
```

`execute()` remains the **only** Workspace data-plane path and **still always** `resolveMembership` before Commerce/Execution.

---

## 2. Context

Closed contract (`6b0c746f`): Identity owns `createWorkspace`; trusted Actor from `resolveActor`; empty caller body; atomic Workspace + first Membership; no `AuthorizationContext` returned.

This gate answers only:

> Where does that Identity operation **enter** the running system?

Current runtime: public package surface is `createPulseV2Gateway` → `execute()`. `IdentityPort` is injected **into** Gateway (`PulseV2GatewayOptions`). Every public `execute()` runs `resolveActor` then `resolveMembership` then constructs `AuthorizationContext`. Identity tables are empty (`IDENTITY_TABLES = []`). `createWorkspace` does not exist on the port.

Concurrent working-tree changes exist **outside** `packages/pulse-v2` (compliance / bootGate / tmp SQL). They are **not** this gate.

---

## 3. Existing invariants

| Source | Constraint that applies here |
|--------|------------------------------|
| Quality Charter | All V2 **domain** work enters through in-process Gateway. Use existing `correlationId`. No second identity system, event bus, or permission catalog. |
| Slice 4 / SEC-001 | Trusted Actor only from `resolveActor(IdentityProof)`. Caller `actorId` never authority. |
| Slice 4 `execute()` | Membership verification **before** domain dispatch. Payload `workspaceId` never authority. |
| SEC-002 | Exported domain handlers must not become the public authorization path. |
| OPEN A | Actor ≠ Membership. First login does not create Workspace. |
| OPEN B | Data-plane: Membership.active + domain authorization. |
| createWorkspace contract | Bootstrap is **not** a data-plane domain operation; must not require Membership. |
| ADR-014 | One authorized Workspace **context** per session **after** membership exists. |
| Law #6 (Charter) | Identity **authenticates**; Pulse **authorizes** via Actor → Membership → Workspace. Does **not** forbid Pulse Identity from **owning** Workspace/Membership writes. |
| Law #1–#3 | Workspace owns data; Products do not call Products. Bootstrap is Identity, not a Product. |
| Day-1 | One deployable modular system; IdentityPort in-process. |

**Does not constrain this gate:** Product entitlement, PlatformPermission, Role names, CommandEnvelope `tenantId` mapping (already deferred).

---

## 4. Bootstrap lifecycle

**Before**

```text
Actor exists
Membership does not exist
Workspace context does not exist
AuthorizationContext does not exist
execute() → V2_MEMBERSHIP_DENIED
```

**Bootstrap (this boundary)**

```text
Trusted Actor
      ↓
Identity.createWorkspace   // Identity authority
      ↓
Workspace + first Membership.active
```

**After**

```text
Later execute()
      ↓
resolveActor + resolveMembership
      ↓
AuthorizationContext
      ↓
Commerce / Execution
```

**Identity bootstrap authority** ≠ **Workspace data-plane authority**.

---

## 5. Option A — Gateway bootstrap boundary

```text
Authenticated request
        ↓
Gateway bootstrap entry ≠ execute()
        ↓
require correlationId
        ↓
resolveActor(IdentityProof)
        ↓
optional actorId claim mismatch → V2_ACTOR_DENIED
        ↓
Identity.createWorkspace({ actorId: trusted, correlationId })
        ↓
Identity-owned success { workspaceId, membershipId, actorId, membershipStatus, correlationId }
```

**Must not** call `resolveMembership()` before create. **Must not** build `AuthorizationContext` for create. **Must not** dispatch Commerce/Execution.

**Must not** special-case `execute({ domain, operation: "createWorkspace" })` to skip membership: that would teach `execute()` that some operations skip the Workspace invariant (SEC-005-class weakening).

Gateway **invokes**; Identity **owns** Workspace + Membership writes.

---

## 6. Option B — Identity outside Gateway

```text
Authenticated request
        ↓
Identity boundary (not Gateway)
        ↓
resolveActor → createWorkspace
```

`IdentityPort` today is a **port Gateway consumes**, not a second public façade. Exporting `createWorkspace` for callers would:

- Duplicate proof, `correlationId`, `V2_ACTOR_DENIED`, and (later) Auth integration already on Gateway
- Resemble SEC-002 (authorization-sensitive write reachable without Gateway)
- Leave `execute()` “pure” but create **two** application entries to secure, observe, and rate-limit

Identity **ownership** of the write is already Option A. Option B only moves the **invocation** off Gateway.

---

## 7. Security analysis

| ID | Meaning | Option A | Option B |
|----|---------|----------|----------|
| SEC-001 | Actor from `resolveActor` only | Same Gateway proof path as `execute()` | Must re-implement proof→Actor on a second entry; risk of accepting caller `actorId` |
| SEC-002 | No handler bypass | Bootstrap stays on Gateway object; domains unused | Public Identity create is a **new** bypass class |
| SEC-003 | Repos not authz | Create does not touch Commerce/Execution repos | Same if Identity persist stays behind Identity |
| SEC-004 | Context request-scoped | Create **does not** produce `AuthorizationContext` | Same |
| SEC-005 | Nested public `execute` | Bootstrap is not nested `execute()`; data-plane nested dispatch unchanged | Unrelated; still must not call public `execute()` from domains |
| SEC-006 | IdentityPort fail closed | Same port; throws fail-stop until H1 mapping | Second call site must also fail closed |
| SEC-007 | `"ok" in ctx` | Bootstrap returns Identity result, not ctx | Same |

Option A keeps **one** untrusted-caller surface (`createPulseV2Gateway`) for both bootstrap and data-plane, with **different methods** so invariants do not collide.

---

## 8. Identity ownership analysis

Identity remains authority for Actor, Workspace, Membership, first Role assignment.

`resolveActor` is an Identity **primitive**. `createWorkspace` **belongs behind Identity** (contract). Putting **invocation** on Gateway does not transfer ownership: Gateway passes trusted `actorId` + `correlationId` only.

`IdentityPort` later may grow `createWorkspace` as the **façade Gateway calls**. That is still not a public Experience API. **Not implemented now.**

---

## 9. Gateway analysis (current code)

`pulseV2Gateway.ts`:

- Public `execute()` **always** `resolveAuthorizationContext` → `resolveActor` **and** `resolveMembership` → `AuthorizationContext` → `dispatch` (`commerce` \| `execution` only).
- Nested `dispatch` **reuses** ctx; does not re-resolve.
- `V2DomainName` has **no** `identity`.
- Missing membership → `V2_MEMBERSHIP_DENIED`; domain never runs.

**Every current public Gateway operation requires Membership.** `execute()` is inherently Workspace data-plane.

`createWorkspace` **cannot** fit inside `execute()` without either (a) failing for Actors with no Membership, or (b) skipping membership for some operations — which **weakens** the data-plane invariant.

A **separate** Gateway method preserves `execute()` unchanged.

---

## 10. Idempotency analysis

Command Envelope v1 has `idempotencyKey` and **requires `tenantId`**. Bootstrap has **no** Workspace yet; the createWorkspace contract already forbids treating this as a frozen CommandEnvelope write.

| Concern | Option A | Option B |
|---------|----------|----------|
| Duplicate-create on retry | Same Identity risk | Same Identity risk |
| Where a future key lives | Gateway request **metadata** passed into Identity command (existing field name, not a new mechanism) | Identity request metadata; Gateway unused |
| Separate idempotency infra | Not required | Tempting second store if Identity is a second app entry |

**Not implemented.** Boundary choice does **not** invent a new key type. Prerequisite remains: Identity-owned idempotency using **existing** `idempotencyKey` naming, with `tenantId` **not** Workspace authority.

---

## 11. Correlation / observability analysis

Gateway already requires `correlationId` on `execute()` (`V2_GATEWAY_INVALID` if empty). Quality Charter: `correlationId` across Gateway → domain → persistence.

Option A: bootstrap uses the **same** required `correlationId` and `V2_*` error shape.

Option B: Identity must require `correlationId` independently or lose AC-OBS-1 for the first Workspace.

No second tracing product.

---

## 12. Error ownership

| Failure | Owner | Code convention |
|---------|--------|-----------------|
| Invalid / missing proof, Actor not found | Identity (`resolveActor`) surfaced by Gateway | `V2_UNAUTHENTICATED` |
| Caller `actorId` ≠ trusted | Gateway (SEC-001) | `V2_ACTOR_DENIED` |
| Caller `workspaceId` as authority | Gateway | `V2_WORKSPACE_DENIED` |
| Missing `correlationId` | Gateway | `V2_GATEWAY_INVALID` |
| Atomic Workspace+Membership persist fail | Identity | `V2_WORKSPACE_CREATE_FAILED` |
| Future idempotency conflict | Identity | reuse create-failed / existing conventions — **not** a domain error |

Not Commerce/Execution errors.

---

## 13. Event implications

No `WorkspaceCreated` in V2/contracts catalogs. **Future only**, after atomic success, existing event envelope. Invocation boundary does not create a bus. Option A: Gateway does not publish as Product; Identity (or existing catalog publisher) would emit later if authorized.

---

## 14. Microservice / extraction implications

Day-1: **in-process** Gateway + IdentityPort. No extra process, hop, Kafka, Redis, mesh.

Option A: extract Identity later by swapping the port implementation; **invocation** stays Gateway. Option B: Experiences would already depend on a second entry, which **looks** like a service before an extraction ADR.

Domain boundary ≠ deployable. This gate is **not** a microservice decision.

---

## 15. Trade-off comparison

| Criterion | Option A | Option B |
|-----------|----------|----------|
| Preserves current Gateway invariant | `execute()` unchanged; membership always required there | `execute()` unchanged, but a second public write path exists |
| Keeps bootstrap distinct from data plane | Separate Gateway entry; no `AuthorizationContext` | Distinct by being off Gateway |
| Identity ownership clarity | Writes stay Identity; Gateway invokes | Writes Identity; invocation also Identity |
| Actor trust boundary | Reuses Gateway `resolveActor` + `V2_ACTOR_DENIED` | Must clone that discipline |
| Membership bootstrap safety | No `resolveMembership` before create | Same if implemented carefully |
| Correlation/observability | Existing Gateway `correlationId` | Must duplicate |
| Idempotency ownership | Identity command; Gateway may pass metadata | Identity only; risk of second infra |
| Error ownership | Identity fail → existing `V2_*` at Gateway | Identity codes without Gateway mapping |
| Future Identity extraction | Port behind Gateway | Callers already skip Gateway |
| Avoids second application boundary | **Yes** — one façade, two methods | **No** |
| Fits modular-monolith | Matches `createPulseV2Gateway` public API | Splits public API |
| Future Auth integration | Proof already enters Gateway (`identityProof`) | Second Auth→Identity path |

---

## 16. Decision

**Option A.**

`Identity.createWorkspace` enters through a **distinct non-data-plane Gateway bootstrap entry**, after `resolveActor`, **without** `resolveMembership`, **without** `AuthorizationContext`.

Normal `execute()` is **not** that entry.

---

## 17. Decision rationale

1. **Coded Gateway:** `execute()` is Membership-gated data-plane. Fitting create into it requires skipping membership — a security invariant change. A sibling method does not.
2. **Public surface:** `src/index.ts` already exposes Gateway, not domain handlers. Bootstrap belongs on that façade so untrusted callers do not gain a second Identity write API (SEC-002 analogue).
3. **Quality Charter:** in-process Gateway is the established application invocation boundary; `correlationId` already lives there.
4. **SEC-001 / OPEN A:** proof → `resolveActor` is already Gateway-owned sequencing. Reuse it.
5. **Identity still owns** Workspace + Membership (createWorkspace contract). Invocation ≠ ownership.
6. **Option B** does not add Identity ownership; it adds a second application boundary that must be secured, correlated, rate-limited, and Auth-integrated separately — without repository evidence that Gateway cannot host a non-data-plane method.

Law #6 does not force Option B: authentication remains Auth; Pulse Identity still authorizes Membership/Workspace; Gateway does not become Auth.

---

## 18. Explicit non-decisions

Auth provider, JWT, session, OAuth/OIDC, SSO, SCIM, Workspace/Membership/Actor schema, migrations, RLS, hosted V2, Role names, permission catalog, Product/Capability, Workspace data model, microservice extraction, event bus/envelope, production Identity, Gateway **method name**, request TypeScript types, `idempotencyKey` on the bootstrap request, CommandEnvelope `tenantId` bootstrap mapping.

---

## 19. Future implementation prerequisites

Not authorized now:

1. Distinct Gateway bootstrap method (name TBD) that: require `correlationId` → `resolveActor` → deny actor spoof → **not** `resolveMembership` → `Identity.createWorkspace`.
2. `IdentityPort.createWorkspace` (or Identity command behind the port).
3. Persistence / atomicity implementation.
4. Bootstrap idempotency using existing `idempotencyKey` naming (no new mechanism; no Workspace `tenantId` as authority).
5. Optional later `WorkspaceCreated` event.
6. SEC-006 throw mapping on the new entry (same H1 as `execute()`).

`execute()`, Commerce, Execution, `AuthorizationContext` construction for data-plane: **unchanged**.

---

## 20. Next gate

**Identity bootstrap idempotency** — how the existing `idempotencyKey` convention applies to `Identity.createWorkspace` when no Workspace `tenantId` exists yet. Design only. No runtime.

Not Slice 5. Not Auth. Not schema.

---

### Validation

1 Bootstrap does not require existing Membership — **pass**  
2 Data-plane `execute()` still requires Membership — **pass**  
3 Trusted Actor from Identity `resolveActor` only — **pass**  
4 Caller Workspace id not authority — **pass**  
5 Identity owns Workspace + Membership writes — **pass**  
6 No new permission catalog — **pass**  
7 No new authentication mechanism — **pass**  
8 No alternate data-plane bypass (`execute()` invariant intact; bootstrap is not domain dispatch) — **pass**  
9 Current Gateway security invariants for `execute()` remain intact — **pass**  
10 One deployable modular system — **pass**  
11 No runtime changes — **pass**  
12 Production untouched — **pass**
