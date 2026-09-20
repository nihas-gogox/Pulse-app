# Pulse V2 — Slice 4 Adversarial / Security Review

**Kind:** Architecture review only. No implementation.  
**Checkpoint:** `ee8f9aaa` — `feat(v2): establish trusted authorization context boundary`  
**Slice 4 implementation:** accepted and frozen.  
**This document does not authorize Slice 5, Auth, Membership persistence, RLS, or OPEN A/B.**

---

## 1. Review scope

Adversarial review of the implemented authorization seam at `ee8f9aaa` against the seven required questions, additional attack scenarios, ADRs 013–015, Slice 4 design/plan, Quality Charter, and Slice 1–2 isolation.

Threat model: attacker controls request payload, `workspaceId`, `membershipId`, `actorId`, other request fields, ordering, repetition, and malformed input. Attacker does **not** control server code, deployment, Gateway internals, or DBA privileges.

---

## 2. Repository checkpoint

Inspected as implemented (not assumed from docs):

- `src/gateway/pulseV2Gateway.ts`, `src/gateway/types.ts`
- `src/identity/authorizationContext.ts`, `identityPort.ts`, `memoryIdentityPort.ts`
- `src/domains/commerce/api.ts`, `src/domains/execution/api.ts`
- `tests/authorization.test.ts`, `tests/gateway.test.ts`
- Slice 1 table/import guards, Slice 2 `V2TenantContext`, deny-all RLS
- ADRs 005, 013, 014, 015; Identity Gate; Quality Charter; frozen Command Envelope (unused by V2 `execute()`)

---

## 3. Threat model

| In scope | Out of scope |
|----------|----------------|
| Forged/mismatched `workspaceId` | Compromised Node process |
| Forged `membershipId` / `actorId` on `execute()` | DBA / service-role |
| Nested payload substitution | Changing Gateway source |
| Repeated `execute()` | Hosted V2 (not provisioned) |
| Direct import of domain handlers (developer misuse; noted as hardening) | Production Identity |

---

## 4. Trusted authorization path (as coded)

```text
execute(request)
  → require correlationId
  → require actorId (harness; OPEN A)
  → IdentityPort.resolveMembership({ actorId, membershipId? })  // once
  → if payload.workspaceId set and ≠ membership.workspaceId → deny
  → AuthorizationContext { actorId, membershipId, workspaceId, correlationId }
  → dispatch(request, ctx)
       nestedExecute(inner) = dispatch(inner, ctx)  // no second lookup
```

Commerce `createTripFromOrder` nested call omits `workspaceId`; Execution uses `authz.workspaceId`.

---

## 5. Q1 — AuthorizationContext forgery

**Verdict: CONDITIONALLY SAFE**

- **Intended construction:** only `resolveAuthorizationContext` in `pulseV2Gateway.ts` (lines 25–63).
- **Type:** plain object (`authorizationContext.ts`). No brand, freeze, or runtime guard.
- **Domains:** `handleCommerceOperation` / `handleExecutionOperation` are **exported** and accept any structurally matching object. They are **not** re-exported from `src/index.ts` (only `createPulseV2Gateway`).
- **Caller Workspace:** cannot become `ctx.workspaceId`; mismatch → `V2_WORKSPACE_DENIED`.
- **Caller Membership / Actor:** `request.membershipId` and `request.actorId` **do** enter resolution (see Q3). Workspace on the context still comes from the **membership row**, not payload.
- **Nested:** `dispatch(inner, ctx)` does not rebuild context from inner `actorId` / `membershipId` / `workspaceId`.
- **Structural typing:** a future in-process caller can pass a literal `{ actorId, membershipId, workspaceId, correlationId }` into a handler if they import `api.ts` directly.

Under the stated threat model (no control of server code), remote-style callers only have `execute()`. Forgery of `AuthorizationContext` then requires going through Gateway. Direct handler import is a **maintainability / next-stage** issue (SEC-002), not a current remote P0.

---

## 6. Q2 — Gateway bypass

**Verdict: CONDITIONALLY SAFE** for the implemented Commerce → Execution path; **bypass is possible via exported handlers/repos** if a developer imports them.

- Public package API: `createPulseV2Gateway` → `execute()`.
- Only nested domain path: Commerce `createOrder` → `execute({ domain: "execution", operation: "createTripFromOrder", payload: { orderId } })` which is the **Gateway-provided** `nestedExecute`, not a new public `execute()`.
- Nested path **preserves** `ctx` (Q5).
- `handleCommerceOperation` / `handleExecutionOperation` **can** be imported from domain `api.ts` without Gateway.
- Repositories (`createCommerceMemoryRepository`, etc.) accept `V2TenantContext` with any `workspaceId` (Slice 2 tests do this on purpose).

Bypass is **obvious** (exported functions) rather than hidden `.from()`. Slice 1 guards block table access from Gateway/domain app code, not handler imports.

---

## 7. Q3 — Membership selector manipulation

**Verdict: CONDITIONALLY SAFE** for Workspace substitution; **Actor field is caller-controlled until OPEN A**.

Caller-controlled inputs to resolution: `request.actorId`, `request.membershipId`, `request.payload.workspaceId`.

| Input | Effect in `memoryIdentityPort` + Gateway |
|-------|------------------------------------------|
| `workspaceId` | Compared after membership; cannot grant another Workspace |
| `membershipId` | Looked up **only among that `actorId`'s rows**; another actor’s id → `invalid_selector` |
| `actorId` | **Selects which Actor the port resolves.** No Auth. Impersonation of any fixture Actor |

Test port **does** bind selector to `actorId` (`forActor.find`). A future IdentityPort that loads membership by id **without** actor check would be a P0. That is a prerequisite for real Membership, not a current catalog decision.

---

## 8. Q4 — Stale AuthorizationContext

**Verdict: SAFE** for current **synchronous**, **request-scoped** `execute()`.

- `ctx` is a local binding in `execute` / `dispatch`. Not stored on the Gateway instance.
- Each public `execute()` builds a new context.
- Nested work is synchronous; no async continuation, events, or Command Store.
- `correlationId` is copied onto context for tracing; it is **not** an authorization secret.
- Persistent authorization is membership in the IdentityPort, not the context object.

**Future risk:** async handlers, event consumers, or freezing not applied (SEC-004). Command Envelope `tenantId` is unused by V2 `execute()`; do not treat correlation as authz.

---

## 9. Q5 — Second authorization context / duplicate lookup

**Verdict: SAFE** for the current execution tree.

Invariant: **one public `execute()` → one `resolveMembership` → one `AuthorizationContext` for that tree.**

Evidence: `nestedExecute = (inner) => dispatch(inner, ctx)` does not call `resolveAuthorizationContext`. Tests: nested `createOrder` increments `lookupCount` by **1**.

Exceptions: a **second public** `execute()` (e.g. later `getTrip`) is a new request (correct). A future domain that calls `createPulseV2Gateway().execute` instead of injected `nestedExecute` would break the invariant (SEC-005).

Nested inner `actorId`/`membershipId` are **ignored** (context not replaced). That prevents nested context replacement.

---

## 10. Q6 — Fail-closed

**Verdict: SAFE** for coded deny paths; **CONDITIONALLY SAFE** for exceptions.

| Condition | Behavior | Domain runs? |
|-----------|----------|----------------|
| Missing `correlationId` | `V2_GATEWAY_INVALID` | No |
| Missing `actorId` | `V2_UNAUTHENTICATED` | No |
| Membership not_found / inactive / ambiguous / invalid_selector | `V2_MEMBERSHIP_DENIED` | No |
| Payload Workspace ≠ membership | `V2_WORKSPACE_DENIED` | No |
| Unknown domain | deny after authz (membership already resolved) | No domain op |
| IdentityPort **throws** | Exception propagates; **not** mapped to deny | No (fail-stop) |
| Authz success then business miss | `COMMERCE_NOT_FOUND` / etc. | Handler ran, scoped |

No coded path returns `ok: true` after a failed membership/workspace check.

Distinguish later: unauthenticated vs membership denied vs workspace denied vs domain invalid vs uncaught throw (infra).

---

## 11. Q7 — Test IdentityPort / OPEN A

**Verdict: SAFE** (does not dictate OPEN A)

`createMemoryIdentityPort` uses opaque `actorId` strings. No Auth provider, `auth.users`, Person, JWT, claims, SQL, or permission catalog. Status enum is a test lifecycle, not RBAC.

It **does** assume: membership is a row with actor+workspace+status; selector is scoped to actor. Those match Slice 4 **design**, not Auth mapping.

---

## 12. Additional attack scenarios

| Scenario | Result in current code |
|----------|-------------------------|
| Trusted W1, payload W2 | `V2_WORKSPACE_DENIED` (tested) |
| Actor A + B’s `membershipId` | `invalid_selector` (port filters by actor) |
| Payload/harness `actorId` = B | Resolves **B** if B exists in port (OPEN A; SEC-001) |
| Gateway W1 → nested payload W2 | Execution **ignores** payload Workspace; uses `authz.workspaceId` (W1) |
| Request A then Request B | Independent `execute()`; no shared ctx |
| Authz failure then domain | Domain not invoked |
| Duplicate lookup in one tree | Not in current Commerce→Execution path |
| Call `handleExecutionOperation` without Gateway | Possible if importer supplies a forged context (SEC-002) |

---

## 13. Production-quality alignment

Does **not** reintroduce org-wide member fan-out, global invalidation, unbounded `.in()`, or domain `.from()`. Membership resolve is one in-memory filter per public `execute()`. `correlationId` is on deny and success. Persistence still Slice 2 scoped. Deny-all RLS unchanged.

Authorization is bounded, request-scoped, and observable **for this in-process cut**.

---

## 14. Findings

| ID | Severity | Question | Evidence | Attack / failure | Current impact | Future impact | Required decision | Recommended future action |
|----|----------|----------|----------|------------------|----------------|---------------|-------------------|---------------------------|
| **SEC-001** | **P1** | Q3 / Actor substitution | `V2GatewayRequest.actorId`; `resolveAuthorizationContext` uses it as Actor | Untrusted `execute()` caller sets `actorId` to another fixture Actor | In-process tests: caller is the test. No HTTP. Impersonation of any Actor **in the injected port** | If `actorId` remains client-supplied after real Auth, **cross-Actor** access | OPEN A: credential → Actor must replace caller `actorId` | When Auth is designed: do not trust request `actorId`; bind Actor from credential inside Gateway |
| **SEC-002** | **P2** | Q1 / Q2 | Exported `handleCommerceOperation` / `handleExecutionOperation`; plain `AuthorizationContext` | In-process import of handlers with a hand-built context | Not on `index.ts` public surface; requires importing `api.ts` | HTTP or sloppy imports skip Gateway | None now | Later: unexport handlers or brand/freeze context; lint that domains only run via Gateway |
| **SEC-003** | **P2** | Q2 | Repositories take `V2TenantContext`, not `AuthorizationContext` | Direct repo use with arbitrary `workspaceId` (existing Slice 2 tests) | Intended for persistence unit tests | Same if repos leak to untrusted callers | None | Keep repos behind Gateway in any real client |
| **SEC-004** | **P2** | Q4 | `ctx` is a mutable object shared with nested `dispatch` | If a handler assigned `authz.workspaceId = "W2"`, nested Execution would follow | Current handlers do not mutate `authz` | Async/event reuse or mutation | None | Later: `Object.freeze` context; never persist it |
| **SEC-005** | **P2** | Q5 | Nested path depends on using injected `execute` | Future code calling public `execute()` from a domain | Current Commerce uses injected nested execute | Second membership lookup / new context | None | Document/enforce: domains only use injected nested execute |
| **SEC-006** | **P2** | Q6 | No try/catch around `identityPort.resolveMembership` | Port throw ≠ typed deny | Domain does not run (fail-stop) | Unhandled exception vs `V2_MEMBERSHIP_DENIED` | None | Later: map port failures to deny |
| **SEC-007** | **P3** | Q1 | `"ok" in ctx` to distinguish deny vs context | If `AuthorizationContext` ever gained `ok`, discriminator breaks | Works today | Mis-dispatch | None | Keep context fields disjoint from `{ ok }` |

No **P0** (unauthorized Workspace via payload, or selecting another Actor’s membership by id alone) in the **current** Gateway+test-port path.

---

## 15. Deferred security prerequisites (not findings)

| Deferred | When it becomes a prerequisite |
|----------|--------------------------------|
| OPEN A — Auth → Actor | Before any untrusted client calls `execute()` |
| OPEN B — permission catalog | Before Admin vs Operations operation checks |
| RLS deny-all | Before exposing local/hosted Postgres with anon key as a security boundary |
| Membership persistence | Before production-like Identity; port must keep actor-scoped selector |
| ADR-015 local-only | Intentional; hosted Auth/PITR not required for this seam |
| No V2 UI boot | Intentional; Expo production frozen |

---

## 16. OPEN A

Auth-subject → Actor mapping **remains OPEN**. SEC-001 is the dependency: do not treat `request.actorId` as the long-term Actor authority.

---

## 17. OPEN B

Permission catalog **remains OPEN**. Membership `active` is the only platform check. Not a vulnerability for this cut.

---

## 18. Overall review conclusion

### ACCEPTABLE WITH REQUIRED HARDENING

No P0 on the Workspace-override or cross-membership-id paths that Slice 4 claimed to close. One **P1** (caller-controlled `actorId`) must be closed **before** the next **implementation** stage that exposes `execute()` to untrusted callers or adds real Auth. P2 items are hardening before scaling (freeze context, don’t export handlers, nested execute discipline).

---

## 19. Recommended next architecture step

**Owner decides.** Strictly from findings:

1. **Targeted Slice 4 hardening review/plan** (not coding unless authorized): how OPEN A will retire `request.actorId`; consider freeze/unexport (SEC-002–004).  
2. Then **OPEN A** (Auth-subject → Actor) as architecture, still not Auth implementation.  
3. Not yet: OPEN B, Membership SQL, RLS, hosted V2, Slice 5.

This review **does not authorize** any of those.

---

*No runtime, tests, migrations, Auth, RLS, or production files were modified for this review.*
