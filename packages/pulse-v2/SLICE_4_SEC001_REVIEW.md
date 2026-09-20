# Pulse V2 — SEC-001 Targeted Re-Review

**Kind:** Architecture / security review only. No implementation.  
**Question:** Has caller-controlled Actor identity been closed at the Gateway authorization boundary?  
**Does not authorize:** Slice 5, Auth, OPEN A/B, SEC-002–007 fixes.

---

## 1. Review scope

Targeted re-review of **SEC-001 only** after `a60aad5a`. Not a new broad Slice 4 review.

Inspected code (not docs-as-truth):

- `src/gateway/pulseV2Gateway.ts`
- `src/gateway/types.ts`
- `src/identity/identityPort.ts`
- `src/identity/memoryIdentityPort.ts`
- `src/identity/authorizationContext.ts`
- `src/domains/commerce/api.ts` (nested `execute` only)
- `src/index.ts` public surface

Threat model unchanged: attacker controls request fields; not server source.

---

## 2. Current checkpoint

| Item | Value |
|------|--------|
| Runtime | `a60aad5a` — `feat(v2): remove caller actor authority` |
| Prior review | `8454a1a5` |
| Hardening plan | `df7cbe15` |
| Quality Charter | `c588b19e` |
| HEAD at this review | `a60aad5a` |

---

## 3. Trusted Actor path (as coded)

```text
execute(request)
  → IdentityPort.resolveActor({ value: request.identityProof })
  → if !ok → V2_UNAUTHENTICATED (no membership, no domain)
  → if request.actorId set and ≠ trusted Actor → V2_ACTOR_DENIED (no membership, no domain)
  → resolveMembership({ actorId: trustedActorId, membershipId? })
  → if !ok → V2_MEMBERSHIP_DENIED
  → if membership.actorId ≠ trusted Actor → V2_MEMBERSHIP_DENIED
  → if payload.workspaceId set and ≠ membership.workspaceId → V2_WORKSPACE_DENIED
  → AuthorizationContext { actorId, membershipId, workspaceId from membership, correlationId }
  → dispatch(request, ctx)
       nestedExecute(inner) = dispatch(inner, ctx)
```

`request.actorId` is documented untrusted (`types.ts` lines 10–14). It is never passed to `resolveMembership`.

---

## 4. Actor spoofing

**Setup:** `resolveActor` → Actor A; `request.actorId` = B.

| Question | Code |
|----------|------|
| Where is Actor obtained? | `resolveActor` only (`pulseV2Gateway.ts` 30–40). |
| Is B used for authorization? | **No.** Compared, then deny. |
| Can B influence membership? | **No.** Membership uses `trustedActorId` only (line 51). Spoof returns **before** line 50. |
| Can B reach AuthorizationContext? | **No.** |
| Can B reach a domain handler? | **No.** `dispatch` only after context is built (131–134). |
| Exact error | `V2_ACTOR_DENIED` / `caller actorId is not authorization authority` |
| Membership lookup? | **No.** `lookupCount` is incremented only in `resolveMembership`. |

**Matches expected deny path.**

---

## 5. Omitted actorId

If `request.actorId` is missing or whitespace, `claimedActorId` is `""` and the mismatch check is skipped (lines 41–42). Membership input is still `trustedActorId` from `resolveActor`. No default copies a caller field into Actor.

**Trusted Actor A is used.** Request remains valid if proof + membership succeed.

---

## 6. Cross-membership substitution

Trusted A; `membershipId` = B’s membership.

Gateway always calls `resolveMembership({ actorId: trustedActorId, membershipId })`.

Test port: `forActor = memberships.filter(m => m.actorId === actorId)` then `find` selector → **`invalid_selector`** if the row is not A’s (`memoryIdentityPort.ts` 40–44).

Gateway additionally: if a port returned `membership.actorId !== trustedActorId` → `V2_MEMBERSHIP_DENIED` (61–67). B’s Workspace cannot become `AuthorizationContext.workspaceId`. Domain is not invoked.

**DENY.**

---

## 7. IdentityProof analysis

**Architectural boundary (Gateway):**

- Proof is `{ value: string }` passed **as-is** to `resolveActor`.
- Gateway **does not** assign `proof.value` to `actorId`.
- Actor id on the context comes from `resolved.membership.actorId` after it was checked equal to `actorResolved.actorId`.

**Test adapter:**

- `createMemoryIdentityPort` binds `proof` string → `actorId` (`actorProofs`).
- Lookup is exact `row.proof === value`. Proof `"actor-a"` is **not** Actor A unless that string was registered as a proof.
- Callers cannot pick an arbitrary Actor by sending an Actor-shaped proof **unless** the injected port maps that value.

That last case is **test/credential possession**, not `request.actorId` authority. A real IdentityPort must not map “type the actor id as proof.” That is **OPEN A**, not a SEC-001 regression.

**OPEN A remains open.** Proof format is a placeholder.

---

## 8. Wrong-membership return

Defective port: trusted A, `membership.actorId` = B.

Lines 61–67 deny with `V2_MEMBERSHIP_DENIED` / `membership is not bound to trusted Actor`. Domain not invoked. Context not built.

**Protection is present in Gateway code**, independent of the memory port.

---

## 9. Workspace substitution

Trusted A / W1; payload `workspaceId` = W2.

Lines 69–76: `V2_WORKSPACE_DENIED`. Context `workspaceId` is `resolved.membership.workspaceId` only.

Commerce/Execution persist `authz.workspaceId` (unchanged). Nested Execution does not re-read payload Workspace as authority.

**W2 cannot become authority.** Slice 4 Workspace protection remains intact.

---

## 10. Nested execution

`nestedExecute = (inner) => dispatch(inner, ctx)` (line 103). Does **not** call `resolveAuthorizationContext`. Inner `actorId` / `identityProof` / `membershipId` are ignored for authorization.

Same object: Actor, membership, Workspace, `correlationId`. Commerce `createTripFromOrder` omits those fields; Execution uses `authz.*`.

**One public `execute()` → one context for the tree.**

---

## 11. Direct domain invocation

`handleCommerceOperation` / `handleExecutionOperation` remain exported. A same-process importer can pass a forged `AuthorizationContext`.

That **bypasses Gateway**, including SEC-001. It is **SEC-002**, not caller `actorId` on `execute()`. Public `src/index.ts` still exports `createPulseV2Gateway`, not handlers.

**Does not undermine SEC-001 at the Gateway `execute()` boundary.** Kept separate. Not re-rated here.

---

## 12. Context mutation

`AuthorizationContext` is a mutable plain object, shared with nested `dispatch`. Current handlers do not assign `authz.actorId` / `membershipId` / `workspaceId`. Inner request fields cannot replace context.

Under the current **synchronous** model, this does **not** reopen caller Actor authority. **SEC-004 remains deferred (H2).**

---

## 13. Lookup invariant

Per **public** `execute()`:

| Call | Count |
|------|--------|
| `resolveActor` | 1 (always, after `correlationId`) |
| `resolveMembership` | 0 if actor fail or actor spoof; **1** if Actor accepted |
| Nested dispatch | 0 additional Actor or membership resolves |

Expected: **one membership lookup per public `execute()`** when authorization proceeds past Actor. Nested Commerce→Execution does not add a second. Actor resolution does not repeat in the tree.

`lookupCount` on the test port counts **membership** only (intentional).

---

## 14. Fail-closed (Actor authorization)

| Condition | Result | Domain |
|-----------|--------|--------|
| Actor mismatch | `V2_ACTOR_DENIED` | No |
| Invalid membership selector | `V2_MEMBERSHIP_DENIED` (`invalid_selector`) | No |
| Membership row for wrong Actor | `V2_MEMBERSHIP_DENIED` (Gateway bind check) | No |
| `resolveActor` typed fail | `V2_UNAUTHENTICATED` | No |
| `resolveMembership` typed fail | `V2_MEMBERSHIP_DENIED` | No |
| IdentityPort **throw** | Exception propagates; **not** `ok: true` | No (fail-stop) |

Unexpected throw cannot become authorization **success**. Mapping throw → typed deny remains **SEC-006 (H1, deferred)**.

---

## 15. OPEN A verification

`identity/` and `gateway/` contain **no** Auth provider, `auth.users`, Person, JWT, federation, SSO, SCIM, or identity-linking implementation.

`IdentityProof = { value: string }` is an opaque placeholder. Mapping proof → Actor is **not** specified beyond the test adapter’s fixture table.

**OPEN A — STILL OPEN.**

---

## 16. OPEN B verification

No permission catalog, RBAC, Product/Experience checks added. Platform check remains membership `active` via IdentityPort. Commerce/Execution operation authorization unchanged.

**OPEN B — STILL OPEN.**

---

## 17. Regression validation

| Command | Result |
|---------|--------|
| `npm run test:v2` | 7 suites, **51 passed** |
| `npm run check:v2-boundaries` | **6 passed** |

Counts match the expected baseline. Tests were not modified for this review.

---

## 18. SEC-001 conclusion

**Has caller-controlled Actor identity been closed at the Gateway authorization boundary?**

**Yes.** `execute()` obtains Actor only from `IdentityPort.resolveActor`. `request.actorId` cannot establish or substitute Actor. Membership and Workspace follow that Actor. Nested dispatch cannot replace it.

Possessing a mapped `identityProof` is the IdentityPort’s job (OPEN A / real credential later), not a restoration of caller `actorId` authority.

### SEC-001 CLOSED — AUTHORIZATION BOUNDARY HOLDS

Slice 4 security posture is **not** “fully complete.” SEC-002–007 remain deferred per the accepted hardening plan.

**Gate:** **SEC-001 CLOSED — READY FOR OWNER REVIEW**

---

## 19. Deferred findings

| ID | Status vs SEC-001 |
|----|-------------------|
| SEC-002 exported handlers | Separate; does not reopen `execute()` Actor authority |
| SEC-003 repositories | Unrelated |
| SEC-004 mutable context | Does not reopen caller Actor under current sync handlers |
| SEC-005 nested public `execute()` | Current Commerce uses injected dispatch |
| SEC-006 IdentityPort throws | Fail-stop, not allow; H1 before real Auth |
| SEC-007 `"ok" in ctx` | Unrelated |

No new critical issue found that reopens SEC-001.

---

## 20. Recommended next architecture step

**Owner decides.** This review does **not** authorize implementation.

Logical next architecture (not code): **OPEN A** — Auth-subject → Actor mapping design, still without Auth implementation, JWT, RLS, or Slice 5.

Alternatively: owner-prioritized P2 (SEC-006 before real Auth; SEC-002/004/005 as hardening).

---

*No runtime, tests, migrations, Auth, RLS, or production files were modified for this review.*
