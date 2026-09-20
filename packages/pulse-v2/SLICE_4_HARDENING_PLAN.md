# Pulse V2 — Slice 4 Security Hardening Plan

**Kind:** Documentation only. No implementation.  
**Does not authorize:** hardening code, Slice 5, Auth, Membership persistence, RLS, OPEN A, OPEN B.

---

## 1. Current checkpoint

| Item | Value |
|------|--------|
| Slice 4 runtime | `ee8f9aaa` — **FROZEN** |
| Security review | `8454a1a5` — `packages/pulse-v2/SLICE_4_SECURITY_REVIEW.md` |
| Quality Charter | `c588b19e` |
| Security gate | **ACCEPTABLE WITH REQUIRED HARDENING** |
| This plan | Does **not** change `ee8f9aaa` |

Inspected at HEAD of this plan (runtime files unchanged from `ee8f9aaa`):

- `src/gateway/pulseV2Gateway.ts`, `src/gateway/types.ts`
- `src/identity/authorizationContext.ts`, `identityPort.ts`, `memoryIdentityPort.ts`
- `src/domains/commerce/api.ts`, `src/domains/execution/api.ts`
- `src/index.ts`, repositories, `tests/authorization.test.ts`

### Review vs implementation

The security review matches the runtime at `ee8f9aaa` for SEC-001–007. No silent reconciliation was required for those findings.

**Stale docs (not runtime bugs):**

| Source | Claim | Actual at `ee8f9aaa` |
|--------|--------|----------------------|
| `SLICE_4_IMPLEMENTATION_PLAN.md` §4 | Gateway has no Actor; handlers use `tenantFromPayload` | Gateway requires `request.actorId`; handlers use `authz.workspaceId` |
| `AuthorizationContext` design | includes `roles`, `permissions` | Implementation has `actorId`, `membershipId`, `workspaceId`, `correlationId` only (OPEN B) |
| `identityPort.ts` comment | “callers supply opaque actorId” | True of **runtime**; this is SEC-001, not OPEN A |
| `V2TenantContext` comment | “Caller-supplied workspace context” | Handlers now copy **trusted** `authz.workspaceId` into it; type is still a persistence DTO |

These discrepancies are documentation drift. They do not reopen Slice 4 implementation.

---

## 2. Security review findings

| ID | Review severity | Topic | This plan |
|----|-----------------|--------|-----------|
| SEC-001 | P1 | Caller-controlled `actorId` | **Must close** before untrusted callers |
| SEC-002 | P2 | Exported domain handlers | Analyzed; not in minimum cut |
| SEC-003 | P2 | Repository `V2TenantContext` | Analyzed; not in minimum cut |
| SEC-004 | P2 | Mutable `AuthorizationContext` | Analyzed; not in minimum cut |
| SEC-005 | P2 | Nested public `execute()` | Analyzed; not in minimum cut |
| SEC-006 | P2 | IdentityPort throws | Analyzed; not in minimum cut |
| SEC-007 | P3 | `"ok" in ctx` discriminator | Confirmed; documentation only |

OPEN A and OPEN B remain **OPEN**. This plan does not resolve them.

---

## 3. SEC-001 root cause

**Root cause:** Gateway treats `V2GatewayRequest.actorId` as the Actor.

```text
execute(request)
  actorId = request.actorId.trim()     // caller field
  if empty → V2_UNAUTHENTICATED
  identityPort.resolveMembership({ actorId, membershipId })
  AuthorizationContext.actorId = resolved.membership.actorId
```

Evidence: `src/gateway/pulseV2Gateway.ts` lines 30–38, 57–58; `src/gateway/types.ts` lines 8–9.

Workspace is already non-authoritative when supplied on payload. Membership id is already scoped to **that** Actor. The remaining authority leak is: **the caller names the Actor**.

This is **not** OPEN A.

| Decision | Status |
|----------|--------|
| How an Auth subject becomes an Actor | OPEN A — **unresolved** |
| Whether the **caller** may name the Actor | SEC-001 — **must be no** |

Until SEC-001 is closed, any party who can call `execute()` can impersonate any Actor that exists in the injected IdentityPort.

Current tests **require** `actorId` on the request (`tests/authorization.test.ts`). That is a harness convenience, not a trust model.

---

## 4. Actor trust model

### Untrusted (never authority)

Anything on `V2GatewayRequest` except values the Gateway has **already** established from the trusted Identity boundary:

- `actorId` (today: trusted — **must stop**)
- `membershipId` (selector only)
- `payload.workspaceId`
- `payload` fields claiming roles, permissions, Product/Experience access, Actor, Workspace
- `correlationId` (tracing only; not identity)

### Trusted (authority)

Only values obtained **inside** Gateway after the IdentityPort (or equivalent) returns them:

- Actor id from **trusted identity resolution**
- Membership row verified **for that Actor**
- `workspaceId` from that membership
- `AuthorizationContext` built by Gateway

### Intended rule

> The caller may identify a **request** (`correlationId`, operation, payload). The caller cannot identify the authorized **Actor**.

### Intended implementation shape (not coded)

```text
Caller
  ↓  untrusted request (no Actor authority)
Gateway
  ↓  IdentityPort.resolveActor(untrustedProof)   // opaque; not OPEN A
trusted Actor
  ↓  IdentityPort.resolveMembership({ actorId: trustedActor, membershipId? })
verified Membership
  ↓  Workspace from membership
AuthorizationContext
  ↓  Domain
```

`untrustedProof` is an **opaque** input the port interprets. This plan does **not** define its contents (not JWT, not `auth.users`, not Person). Tests may inject a fixture proof **into the port**, not an Actor id into the request as authority.

If the request still carries `actorId` after hardening:

- it **must not** be copied into `resolveMembership` or `AuthorizationContext`
- recommended fail-closed: if present and ≠ trusted Actor → deny (spoof)
- equally acceptable: ignore it and authorize as the trusted Actor

Owner chooses deny-vs-ignore (see §19).

---

## 5. OPEN A boundary

**Remains OPEN:** how an Auth subject becomes an Actor.

Hardening needs a **plug-in seam**, not a mapping:

```text
IdentityPort.resolveActor(proof: IdentityProof)
  → { ok: true, actorId } | { ok: false, reason }
```

Conceptual name only. Alternatives (`TrustedPrincipalPort`, Gateway-bound test Actor) are equivalent if they satisfy:

1. Gateway never uses `request.actorId` as Actor.
2. `actorId` on `AuthorizationContext` comes only from this result (then membership).
3. The proof type stays **opaque** so OPEN A can later bind credential → Actor without changing Commerce/Execution.

**Still unresolved (OPEN A):** Auth provider, subject format, `auth.users`, Person, JWT, federation, identity linking, session restore.

**Not OPEN A:** “caller `actorId` is authority.” That is forbidden by this plan.

Test `createMemoryIdentityPort` may map a **fixture proof** → fixture `actorId` internally. That does not decide production mapping.

---

## 6. Membership verification model

Preserve:

```text
trusted Actor → verified Membership → Workspace
```

**Invariant:** Membership is verified against the **trusted Actor**, not looked up by caller `membershipId` alone.

Current `createMemoryIdentityPort` already filters `forActor` then selector (`memoryIdentityPort.ts` lines 23–29). A future SQL port **must** keep the same invariant or it becomes P0.

Caller `membershipId` remains an optional **selector**. It cannot mint another Actor’s membership.

Do not finalize Membership schema in this plan.

---

## 7. SEC-002 analysis — Exported domain handlers

**Evidence:** `handleCommerceOperation` / `handleExecutionOperation` are `export function` in `api.ts`. `src/index.ts` does **not** re-export them. Gateway is the intended caller (`pulseV2Gateway.ts` imports).

**Bypass:** A same-process importer of `src/domains/*/api.ts` can pass a structurally typed `AuthorizationContext` and skip Gateway. That is **developer-controlled** code, outside the review threat model (attacker does not control server source). It is a real **in-process** bypass if application code deep-imports handlers.

Handlers are intended to run only through Gateway.

**Later options (not now):** unexport / package `exports` map; branded or Gateway-only context; lint. Runtime “trusted-context precondition” is optional; TypeScript structural typing cannot enforce it alone.

**Classification:** **hardening only** — not required before untrusted callers **if** the only untrusted surface is `execute()`. Required if other packages start importing `api.ts`. Architectural discipline is sufficient for the current in-process package. Runtime enforcement is **not** required for the minimum cut.

---

## 8. SEC-003 analysis — Repository exposure

**Evidence:** `CommerceRepository` / `ExecutionRepository` take `V2TenantContext` (`workspaceId` + `actorUserId`). Slice 2 tests construct that DTO directly. `createPersistence` / memory factories are exported from `src/index.ts`.

Repositories **can** be invoked without `AuthorizationContext`. That is **intentional** persistence isolation testing, not a second authorization plane.

Domains do not query foreign tables (Slice 1). They can skip Gateway only by importing repositories — same developer-trust class as SEC-002.

Requiring `AuthorizationContext` on repositories would couple persistence to Identity and break Slice 2 unit tests. **Do not** do that in hardening.

**Classification:** **acceptable as-is** for security architecture. Keep repos behind Gateway in any real client. **H2** documentation/discipline, not a trust-boundary change.

---

## 9. SEC-004 analysis — Mutable AuthorizationContext

**Evidence:** `AuthorizationContext` is a plain object; fields are not `readonly`; Gateway does not `Object.freeze`. Nested `dispatch(inner, ctx)` shares the **same object** (`pulseV2Gateway.ts` line 80). Current handlers read `authz.*` and do not assign to it.

A handler **could** mutate `authz.workspaceId` and nested Execution would follow. That is not present in code today.

`readonly` is compile-time only. Freeze is a cheap runtime boundary for nested calls. Stronger branding is unnecessary for the minimum cut.

**Classification:** **recommended hardening (H2)**. Immutable/frozen context should happen before async/event boundaries, not before closing SEC-001. Not mandatory before untrusted `execute()` while handlers remain synchronous and non-mutating.

---

## 10. SEC-005 analysis — Nested public `execute()`

**Evidence:** Commerce nested trip uses injected `nestedExecute = (inner) => dispatch(inner, ctx)` — **not** public `execute()`. Execution has no `execute` parameter. Public `execute` always calls `resolveAuthorizationContext` again.

Current Commerce→Execution tree: **one** membership lookup, **one** context, inner `actorId`/`membershipId` ignored.

A future domain that calls `createPulseV2Gateway().execute` (or the returned public `execute`) would create a **second** context. `V2Execute` is the same function type as public `execute`, which makes misuse easy.

**Classification:** **recommended hardening (H2)** — document and later distinguish nested dispatch (no re-resolution) from public `execute`. Not in the minimum SEC-001 cut. **H1** before adding more nested domain paths if owner wants mechanical enforcement.

---

## 11. SEC-006 analysis — IdentityPort failures

**Evidence:** `resolveMembership` is not in try/catch. Typed `{ ok: false }` → `V2_MEMBERSHIP_DENIED`. A throw **propagates**; domain is not invoked (fail-stop, not allow).

No coded path treats a throw as `ok: true`.

**Eventual fail-closed contract:** any IdentityPort failure (typed deny **or** throw) → Gateway deny; domain not invoked; `correlationId` preserved when known.

**Classification:** **H1 before real Auth** (I/O, network). Memory port is in-process and should not throw. Not required to close SEC-001. Not allow-by-accident today.

---

## 12. SEC-007 analysis — `"ok" in ctx`

**Evidence:** `if ("ok" in ctx) return ctx` (`pulseV2Gateway.ts` line 109). `AuthorizationContext` has no `ok`. `V2GatewayError` has `ok: false`.

Still valid as a maintainability hazard if `ok` is ever added to the context. Severity remains **P3 / H3**. Do not inflate.

---

## 13. Hardening priorities

H0–H3 are **plan priorities**, not the review’s P0–P3.

| ID | H-class | Meaning |
|----|---------|---------|
| **SEC-001** | **H0** | Mandatory before untrusted callers. Mandatory before real Auth (same leak). |
| SEC-006 | **H1** | Mandatory before real Auth (fail-closed mapping of throws). Not H0 for memory port. |
| SEC-002 | **H2** | Discipline + optional unexport before more importers. Owner may promote to H1. |
| SEC-004 | **H2** | Freeze/`readonly` before async/events. |
| SEC-005 | **H2** (owner may promote to **H1** before more nested domains) | Nested vs public execute. |
| SEC-003 | **H2** | Keep repos as persistence DTOs; do not couple to Identity. |
| SEC-007 | **H3** | Discriminator comment / disjoint types. |

---

## 14. Minimum hardening cut

**Goal:** eliminate caller Actor authority. Nothing else.

**Out of cut:** SEC-002–007 implementation, Auth, tables, RLS, OPEN A/B, Slice 5, freeze, unexport handlers, try/catch, repository signature changes.

### Intended files (when later authorized — do not edit now)

| File | Change |
|------|--------|
| `src/identity/identityPort.ts` | Add `resolveActor(proof)` (opaque `IdentityProof`). Keep `resolveMembership({ actorId, membershipId? })`. |
| `src/identity/memoryIdentityPort.ts` | Fixture: proof → Actor **inside the port**; still actor-scope membership. |
| `src/gateway/types.ts` | `actorId` is not authority. Optional untrusted proof field **or** proof only on the port. |
| `src/gateway/pulseV2Gateway.ts` | `resolveActor` then `resolveMembership(trustedActor, selector)`. Never `request.actorId` as Actor. |
| `tests/authorization.test.ts` | Spoof cases in §15. Fixture proof instead of request Actor authority. |
| `tests/gateway.test.ts` | Same Actor source as authz tests. |

**Blast radius:** Gateway + IdentityPort + tests. Commerce/Execution/handlers/repos/persistence/RLS/env **unchanged** if Actor still arrives on `AuthorizationContext` as today.

**Lookups:** still **one** membership resolve per public `execute()`. `resolveActor` is a second IdentityPort call on the **same** public execute — bounded, not org fan-out. Do not add Workspace list fetches.

**Not in this cut:** deciding proof format (OPEN A).

---

## 15. Test plan

To accompany a future hardening implementation (not written now).

| Case | Setup | Expected |
|------|--------|----------|
| **Actor spoof** | Trusted Actor A; caller `actorId` = B | B is not Actor. Context is A, or deny. Domain data is A’s Workspace. |
| **Membership spoof** | Trusted A; caller `membershipId` = B’s membership | `invalid_selector` / membership denied. No B Workspace. |
| **Workspace spoof** | Trusted A, membership → W1; payload `workspaceId` = W2 | `V2_WORKSPACE_DENIED`. Unchanged from Slice 4. |
| **Combined spoof** | Caller `actorId=B`, `membershipId=B`, `workspaceId=W2`; trusted A / W1 | Context cannot become B/W2. A/W1 or fail closed. |
| **Unauthenticated** | No trusted Actor from port | Deny; domain not invoked. Not “empty actorId on request” as the sole definition. |
| **Nested execution** | `createOrder` → `createTripFromOrder` | One membership resolve for the public `execute()`. Same `AuthorizationContext`. No replacement. |
| **Identity failure** | `resolveActor` or `resolveMembership` typed fail **and** throw | Deny or mapped deny; handler not invoked; never `ok: true`. |
| **Direct domain invocation** | Import `handleCommerceOperation` with forged context | **Out of minimum cut.** If owner later requires it: reject missing Gateway-issued context. Until then: discipline only; no new test required for H0. |

Existing Slice 4 tests (payload Workspace, selector, ambiguous, nested lookup count) must **keep** failing closed after the Actor source changes.

---

## 16. Quality Charter alignment

| Charter / invariant | Hardening cut |
|---------------------|----------------|
| Bounded authorization; one membership resolve per execute | Keep; add one bounded `resolveActor` per public execute only |
| No global Workspace fetch / broad invalidation | Unchanged |
| No cross-domain table access | Unchanged |
| Predictable failure | Typed deny; throws remain fail-stop until SEC-006 |
| Explicit trust boundary | Actor from IdentityPort, not request |
| Observable | Keep `correlationId` on deny/success |
| Narrow blast radius | Gateway + IdentityPort + tests |
| P-Q6 / Law #6 | Identity authenticates; Gateway authorizes via membership |
| P-Q9 | No Kafka, Redis, K8s, new identity **product**, new permission catalog |

---

## 17. Dependencies

| Depends on | For |
|------------|-----|
| Owner accept Actor trust model (§4, §19) | Authorize a later implementation cut |
| IdentityPort `resolveActor` seam | Close SEC-001 without OPEN A |
| Existing actor-scoped membership | Keep membership spoof closed |
| Slice 4 runtime frozen | Do not mix with Slice 5 |

Does **not** depend on: Auth provider, JWT, RLS, Membership SQL, OPEN B, hosted V2.

---

## 18. Deferred decisions

| Item | Status |
|------|--------|
| OPEN A — Auth-subject → Actor | OPEN |
| OPEN B — permission catalog | OPEN |
| Proof / credential format | Deferred with OPEN A |
| SEC-002 unexport / brand | Owner |
| SEC-003 repository types | Deferred; acceptable as-is |
| SEC-004 freeze | Deferred H2 |
| SEC-005 nested execute type | Deferred H2 |
| SEC-006 map throws to deny | H1 before real Auth |
| Membership persistence, RLS, Slice 5, production Identity | Not this plan |

---

## 19. Owner decisions required

This plan **does not** decide the following:

1. **Actor trust boundary** — Accept or reject: caller cannot name the Actor; Gateway uses `IdentityPort.resolveActor(opaque proof)` (or equivalent) then membership.
2. **Spoofing `request.actorId`** — Deny if it disagrees with trusted Actor, or ignore it.
3. **Proof injection in tests** — Port-constructed fixture Actor vs opaque proof on the request (still not Actor authority).
4. **P2 before real Auth** — This plan marks only SEC-006 as H1. Owner may promote SEC-002/004/005.
5. **P2 deferred** — SEC-003 as-is; SEC-007 H3. Confirm.
6. **Direct handler invocation** — Discipline vs later runtime reject.

Do not implement until the owner accepts (1) and authorizes a code cut.

---

## 20. Recommended next step

**Owner review of this plan.** If accepted: a **later, separately authorized** minimum implementation of §14 only.

Then, still architecture-only: OPEN A (Auth-subject → Actor). Not Auth implementation, not Slice 5.

This document does **not** authorize that work.

---

## Final gate

| Item | Status |
|------|--------|
| Slice 4 runtime | `ee8f9aaa` — FROZEN |
| Security review | `8454a1a5` |
| Security gate | ACCEPTABLE WITH REQUIRED HARDENING |
| SEC-001 | MUST CLOSE |
| OPEN A | OPEN |
| OPEN B | OPEN |
| Hardening plan | **READY — OWNER REVIEW REQUIRED** |
| Hardening implementation | NOT AUTHORIZED |
| Slice 5 | NOT STARTED |
| Production | UNTOUCHED |

### SLICE 4 HARDENING PLAN READY — OWNER REVIEW REQUIRED

