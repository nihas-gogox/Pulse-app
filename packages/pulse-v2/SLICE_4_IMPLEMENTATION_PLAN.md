# Pulse V2 — Slice 4 Implementation Plan

**Status:** PLAN ONLY. Implementation **NOT AUTHORIZED**.  
**Owner-accepted design:** `01f697f4` · `SLICE_4_AUTHORIZATION_DESIGN.md`  
**ADRs:** 013 Identity plane · 014 one identity + one Workspace context · 015 local V2-only  

This plan does **not** decide Auth-subject → Actor mapping or the permission catalog.

---

## 1. Executive summary

Slice 4, when later authorized, should be **test-first and additive** inside `packages/pulse-v2` only.

**Safest first cut (without OPEN A or OPEN B):** TypeScript contracts + an injectable **IdentityPort** (test double) + Gateway that **constructs AuthorizationContext from verified membership** and **stops using payload `workspaceId` as tenancy**. Commerce/Execution handlers then receive that context. Persistence stays Slice 2 (memory / local; deny-all RLS). No `v2_identity` tables, no Auth, no JWT, no permission enum.

**Must wait:** real Actor from Auth, membership schema/migrations, JWT/claims, RLS policies, operation RBAC, Product/Experience gates, V2 UI boot, hosted V2, production.

**Result of this document:** **SLICE 4 IMPLEMENTATION PLAN READY — OWNER REVIEW REQUIRED** before any coding.

---

## 2. Accepted decisions

1. One authorized Workspace context per session (ADR-014). Multi-Workspace switching deferred.  
2. Gateway is Day-1 authorization boundary. Caller `workspaceId` never authority.  
3. Membership is Actor → Workspace authority; not inferred from Commerce/Execution rows.

---

## 3. Open decisions (must remain open)

### A — Auth subject → Actor mapping

Do not choose Auth provider, `auth.users`, Person, federation, broker, linking.

**Blocks:** real Actor creation, session restore from V2 Auth, JWT claims, RLS that uses `auth.uid()`, production-like login tests.

**Does not block:** opaque `actorId: string` on an IdentityPort; fixture Actors in tests.

### B — Permission catalog / mapping

Do not freeze `06-permissions.md`, PlatformPermission, capabilities, or contracts `Permission`. No fourth catalog.

**Blocks:** Admin vs Operations operation checks, Product/Experience availability as a real catalog.

**Does not block:** membership `active` as the **only** platform check; documenting that operation RBAC is pending.

---

## 4. Current repository state

| Area | Fact |
|------|------|
| Gateway | `createPulseV2Gateway` → `execute({ domain, operation, payload, correlationId })`. No Actor. |
| Commerce | `handleCommerceOperation` — `tenantFromPayload(payload.workspaceId)` → `V2TenantContext` |
| Execution | Same `tenantFromPayload`; `createTripFromOrder` nested via `execute()` |
| Persistence | Repositories take `V2TenantContext`; filter `workspace_id`; labeled **untrusted** |
| Identity domain | Schema fence; `IDENTITY_TABLES = []` |
| Finance / Network | Schema fences; no `execute()` operations |
| Auth | None in V2 |
| RLS | Enabled, no policies (deny-all) |
| V2 UI / boot | None in `@pulse/v2` (Expo boot is **production**, frozen) |
| Tests | `gateway.test.ts` still sends payload `workspaceId` as tenancy |

Frozen Command Envelope `tenantId` is **not** used by V2 `execute()` today. Do not rewrite the envelope.

---

## 5. Dependency graph

```text
Accepted architecture                          IMPLEMENTABLE NOW (docs only; already done)
        ↓
AuthorizationContext + IdentityPort contracts  IMPLEMENTABLE NOW (types; no Auth)
        ↓
Gateway authorization boundary                 PARTIALLY IMPLEMENTABLE (port + tests; no Auth)
        ↓
Membership authority (in-memory test SoT)      PARTIALLY IMPLEMENTABLE (fixtures only)
        ↓
Membership persistence / v2_identity tables    BLOCKED (schema + OPEN A for real users)
        ↓
Auth subject → Actor mapping                   DEPENDS ON OPEN DECISION A
        ↓
Permission resolution                          DEPENDS ON OPEN DECISION B
        ↓
RLS beyond deny-all                            BLOCKED (needs Auth + membership SoT)
        ↓
Domain enforcement (ctx from Gateway)          PARTIALLY IMPLEMENTABLE (after Gateway)
        ↓
integration / security tests                   PARTIALLY IMPLEMENTABLE (fixtures; not Auth)
```

---

## 6. Implementable-now boundary

When **implementation is authorized**, without resolving A or B:

| Item | Why safe |
|------|----------|
| `AuthorizationContext` type (`actorId`, `membershipId`, `workspaceId`, `roles[]`, `permissions[]` empty-ok, `correlationId`) | Matches accepted design; `permissions` may be `[]` |
| `IdentityPort` / `resolveMembership({ actorId, membershipId? })` | `actorId` opaque; no Auth provider |
| In-memory membership fixtures for tests | Not `v2_identity` migrations |
| Gateway: require port; fail closed (no membership, suspended, revoked, 0 or N memberships without selector, payload `workspaceId` ≠ membership) | Design §13 |
| Domain handlers: drop `tenantFromPayload` as authority; use Gateway ctx | Payload `workspaceId` mismatch → deny |
| Nested `execute()` for createTrip: pass **trusted** workspace from ctx, not as authority from caller | Same correlationId; same ctx |
| Error codes for authz failures | Contract, not schema |
| Query budget: one membership resolve per `execute()` | Quality Charter |

**Not** implementable-now: Auth, Person, tables, RLS policies, permission catalogs, Expo boot, hosted project.

---

## 7. Blocked boundary

| Item | Blocker |
|------|---------|
| Bind credential → Actor | OPEN A |
| JWT / Auth claims / `auth.uid()` RLS | OPEN A + Auth |
| `v2_identity` migrations/tables | Implementation authorization + schema details (not frozen) |
| Operation RBAC (Admin vs Operations) | OPEN B |
| Product/Experience enablement checks | OPEN B + Product Registry on V2 |
| RLS USING policies | V2 Auth + membership SoT |
| Federation / production Identity | ADR-013 forbid + OPEN A |
| Hono | Explicitly dormant |
| Hosted V2 | ADR-015 |

---

## 8. Gateway plan

**Current:** `Gateway → domain handler` with payload tenancy.

**Target:** `Request → Gateway → Actor (via port) → Membership verify → Workspace → AuthorizationContext → (platform check: membership active) → domain handler(ctx, payload)`.

**Likely files (when authorized — do not edit now):**

- `src/gateway/types.ts` — request may gain **untrusted** credential/selector fields later; **do not** treat `payload.actorId` as authority (same class of bug as `workspaceId`)
- `src/gateway/pulseV2Gateway.ts` — call IdentityPort once per `execute()`
- New: `src/identity/` ports only (not tables)
- `src/domains/commerce/api.ts`, `src/domains/execution/api.ts` — remove `tenantFromPayload` as authority
- `src/persistence/tenantContext.ts` — evolve toward “trusted ctx only” (narrow rename later)
- Tests: `tests/gateway.test.ts` + new authz tests

**Contracts:** `@pulse/contracts` Command Envelope **untouched**. V2 stays `execute()`.

**Blocked:** wiring real Auth into Gateway (OPEN A).

---

## 9. Membership plan

**Accepted (design):** `membershipId`, `actorId`, `workspaceId`, unique (`actorId`,`workspaceId`), status `active|suspended|revoked`, role on membership, selector rules, fail closed if multiple active without selector.

**Still requiring decision/schema:** column types, invitation/`pending`, persistence vs memory, indexes. **Do not** invent SQL in this plan.

**Ownership:** Identity domain (`v2_identity`), not Commerce/Execution.

**Repository:** future `MembershipRepository` behind IdentityPort. Tests may use an in-memory adapter **without** migrations.

**Verification:** Gateway-only lookup, **one query per execute()** (or equivalent), keyed by `actorId` (+ optional `membershipId`). No org-wide member lists.

---

## 10. Auth integration boundary

Authorization layer needs eventually:

- Proof that a credential is valid (V2 Auth, local — ADR-015)
- A stable **Auth subject** string
- A function `authSubject → actorId` (**OPEN A** plugs in here)

**Until A:** IdentityPort is given `actorId` only by **test harness**, never by production Auth, never by trusting payload.

**Tests before A:** fixture Actors; unauthenticated = missing port/credential abstraction; invalid Actor = unknown `actorId`.

**Cannot implement until A:** session restore, expired JWT, `auth.uid()` RLS, Person table, federation.

---

## 11. Permission boundary

**Where:** Gateway **after** AuthorizationContext, **before** domain handler.

**AuthorizationContext:** may carry `permissions: []` until OPEN B.

**Product/Experience:** after membership; not implemented until B + registry.

**Domain:** business rules only (e.g. duplicate trip).

**Interface (future):** `authorizeOperation(ctx, domain, operation) → allow | deny`. Implementation of the body **blocked** on B except `membership.status === 'active'`.

---

## 12. RLS prerequisites

```text
V2 Auth (local) → Actor → Verified Membership → Workspace → trusted context → RLS
```

Before any policy other than deny-all: V2 Auth exists, membership SoT exists, Gateway never uses payload as `workspace_id`, no client GUC, no production Identity, no service-role in domain adapters.

**Do not** create policies or migrations in Slice 4 until those exist. Deny-all stays.

---

## 13. Domain enforcement plan

| Domain | Entry | Workspace today | Future ctx | Authz checks | Isolation | Tests |
|--------|-------|-----------------|------------|--------------|-----------|-------|
| **Identity** | None | Fence only | Owns membership SoT | N/A until tables | No domain tables | Port tests |
| **Commerce** | `handleCommerceOperation` | payload | Gateway ctx | membership active; RBAC **blocked** | `sales_orders.workspace_id` | getOrder cross-ws |
| **Execution** | `handleExecutionOperation` | payload | Gateway ctx | same | `trips.workspace_id` | getTrip cross-ws |
| **Finance** | none | fence | no ops | — | — | no handlers |
| **Network** | none | fence | no ops | — | — | no handlers |

Do not add Finance/Network operations in Slice 4.

Nested Commerce→Execution `execute()`: Gateway must apply the **same** AuthorizationContext (not a new payload-tenant hop).

---

## 14. Boot / session plan

**Existing V2:** no app boot, no session restore, no domain UI.

**Production** `app/_layout.tsx` / `bootGate` is **frozen** and out of Slice 4.

**Gap:** V2 Experience lifecycle is **not in this package**. Do not implement Expo boot as V2 Identity.

**When a V2 client exists (later):** map Quality Charter INV-BOOT-* to this Gateway path. Tests for race: no domain `execute()` before context; no render on route match alone.

**Blocked on:** OPEN A (session), V2 client authorization (out of current V2 package).

---

## 15. Security test plan (define only)

**Authentication:** unauthenticated; expired session (**blocked** until A); invalid Actor.

**Membership:** valid; revoked; suspended; none; bad `membershipId` selector.

**Workspace:** authorized; unauthorized; caller changes `workspaceId`; cross-Workspace read.

**Authorization:** allowed op (membership active); unauthorized op (**blocked** until B for role-specific); Product/Experience unavailable (**blocked** until B); domain rule reject (duplicate trip — already exists).

**Isolation:** A/ws1 vs ws2; B cannot inherit A’s Admin (**blocked** until B); domain table guard (Slice 1 already).

**Failure:** ambiguous/multiple memberships without selector; missing context; stale membership (re-read SoT); inactive Workspace.

---

## 16. Blast-radius analysis

| Change | Domains | Contracts | Gateway | Persistence | Tests | Production | Migration | Rollback |
|--------|---------|-----------|---------|-------------|-------|------------|-----------|----------|
| Authz types + IdentityPort | none | V2-only types | types | no | new | none | none | delete types |
| Gateway uses port | commerce, execution via execute | `V2GatewayRequest` possibly | yes | no | gateway + new | none | none | revert gateway |
| Handlers drop payload tenancy | commerce, execution | error codes | callers of execute | still `V2TenantContext` from Gateway | update existing | none | none | restore tenantFromPayload |
| Memory membership fixtures | identity tests | no | port impl | memory only | yes | none | none | delete fixtures |
| v2_identity tables | identity | no | port | yes | yes | **forbidden** | V2 tree only | revert migration **local** |
| Auth | — | — | yes | — | — | **forbidden** | — | — |
| RLS policies | commerce, execution | no | no | yes | yes | **forbidden** | V2 tree | revert local |

Prefer the first four rows. No Expo/`lib/`/`supabase/migrations` production.

---

## 17. Migration strategy

| Aspect | Choice |
|--------|--------|
| Shape | **Staged:** contracts → Gateway+tests → handler ctx → (stop) |
| Tables | **Not** in first stages |
| Feature flag | Optional `IdentityPort`; tests **must** use it; do not ship “payload tenancy if port missing” as trusted authz |
| Production | Untouched |
| RLS | Remain deny-all |

No migration files in this plan’s first implementable commits.

---

## 18. Proposed implementation sequence

Adjusts the example list to **actual** dependencies. **None of these commits are authorized by this document.**

| Future commit | Purpose | Likely files | Dependencies | Blocking decision | Rollback |
|---------------|---------|--------------|--------------|-------------------|----------|
| **1 — contracts** | `AuthorizationContext`, IdentityPort, failure codes | `src/identity/*.ts` (types only), `gateway/types.ts` | accepted design | none | revert files |
| **2 — Gateway boundary** | One membership resolve; build ctx; deny payload escalation | `pulseV2Gateway.ts`, new tests | commit 1; in-memory port | none for fixtures | revert gateway |
| **3 — domain ctx** | Remove `tenantFromPayload` authority | `commerce/api.ts`, `execution/api.ts`, `gateway.test.ts` | commit 2 | none | restore helpers |
| **4 — Membership persistence** | `v2_identity` tables + adapter | migrations (V2 tree), identity repo | commit 2–3 | schema details; **not** OPEN A if Actors remain fixtures | revert V2 migrations locally |
| **5 — Auth integration** | Credential → Actor | new auth module | commit 4 | **OPEN A** | revert |
| **6 — permission resolution** | `authorizeOperation` | Gateway | commit 2 | **OPEN B** | revert |
| **7 — RLS** | policies using trusted workspace | V2 migrations | commits 4–5 | OPEN A + Auth | revert policies; deny-all |
| **8 — security tests** | Matrix §15 | `tests/*` | 2–3 now; 5–7 later | A/B for subsets | revert tests |

**Do not** skip to 5–7. **Do not** start 1 until implementation is explicitly authorized.

---

## 19. Stop conditions

STOP and return to owner if implementation would require:

- deciding Auth-subject mapping or a permission catalog  
- production Identity / `organization_members` / `auth.users`  
- hosted V2  
- RLS based on unapproved identity  
- a fourth permission catalog  
- a new event bus / Kafka / Redis / K8s  
- cross-domain `.from()`  
- a microservice extraction  
- changing ADR-013 / 014 / 015  
- rewriting frozen Command Envelope required fields  
- implementing Expo boot as V2 Identity  

---

## 20. Owner decisions required

Before **any** coding: explicit authorization to implement Slice 4 **foundation** (commits 1–3 only).

Before commit 4: approve membership **schema** (not catalog).

Before commit 5: **OPEN A**.

Before commit 6: **OPEN B**.

Before commit 7: Auth + membership SoT on local V2.

This plan does **not** grant those authorizations.

---

## Validation

| Source | Plan alignment |
|--------|----------------|
| ADR-005 / Workspace | Workspace boundary; not Org/Tenant/login |
| ADR-013 | No production Identity runtime; V2 plane only |
| ADR-014 | One session Workspace; no switcher |
| ADR-015 | Local/memory; no hosted |
| Slice 1 | `execute()` only; table guards |
| Slice 2 | persistence ctx; deny-all; untrusted until Gateway ctx |
| Slice 3 / Identity Gate | selector vs authority; no fourth catalog; Hono dormant |
| Slice 4 design | Gateway constructs ctx |
| Quality Charter | one membership query; no fan-out; no Redis; `correlationId` |
| Contracts / envelopes | frozen envelope not rewritten |
| Gateway / domains | matches actual `tenantFromPayload` files |

No contradiction that would make this plan **BLOCKED**. Implementation remains unauthorized.

---

**SLICE 4 IMPLEMENTATION PLAN READY — OWNER REVIEW REQUIRED**
