# Pulse V2 — OPEN A: Auth-Subject → Actor Architecture

**Status:** Pre-decision analysis. **Owner accepted Model B** — see `OPEN_A_DECISION.md` and `OPEN_A_IMPLEMENTATION_PLAN.md`.  
**Kind:** Architecture / design only. No implementation.  
**Does not authorize:** Auth, Actor/Membership tables, JWT, RLS, hosted V2, OPEN B, Slice 5, production changes.

---

## 1. Objective

Define how a **real authenticated identity** becomes the **trusted Pulse Actor** already consumed by the Slice 4 Gateway:

```text
Authentication → Auth Subject → Actor → Membership → Workspace → AuthorizationContext
```

Plug into the existing seam `IdentityPort.resolveActor(...)` without collapsing Auth into authorization, and without resolving OPEN B.

---

## 2. Current authoritative state

| Source | Preserved |
|--------|-----------|
| **ADR-013** | Isolated V2 Auth allowed; production Identity is not the normal V2 authorization path; one conceptual Identity model; no tables from this ADR |
| **ADR-014** | One Pulse identity/account across platform/services; one authorized Workspace **context** per session; multi-Workspace switching deferred; does **not** prescribe Auth architecture |
| **ADR-015** | Local V2-only sufficient now; hosted V2 not required |
| **Slice 4 / SEC-001** | Gateway is Day-1 authz boundary; caller `actorId` is not authority; `identityProof` opaque; `resolveActor` then membership then Workspace |
| **Law #6 (ADR-005 / 02-identity)** | Identity authenticates only; does not own product/RBAC |

SEC-001 is **CLOSED**. SEC-002–007 remain deferred.

### Contradiction (do not silent-rewrite)

`IDENTITY_AUTHORIZATION_DESIGN.md` §2 **recommended** `actorId = Auth subject (V2 auth.users.id when provisioned)` while the same section left Person vs `auth.users` as **OPEN**.

Slice 4 Actor model and ADR-013 **explicitly** leave Auth-subject → Actor **OPEN** and forbid assuming `auth.users` is the application identity.

This document **does not amend** Slice 3 text. OPEN A was the decision Slice 3 deferred. **Owner subsequently accepted Model B** (`OPEN_A_DECISION.md`). §8 remains the analysis that was reviewed.

---

## 3. Terminology

| Term | Meaning in this design |
|------|-------------------------|
| **Authentication** | Proof that a credential is valid for an Auth authority |
| **Auth Subject** | Stable identifier issued by that Auth authority after validation (not a Workspace, not a role) |
| **Actor** | Pulse application principal used by Gateway authorization (`AuthorizationContext.actorId`) |
| **Person** | Optional human/legal identity concept (ADR-014 Product language). **Not** a required V2 schema entity for OPEN A |
| **Membership** | Actor ↔ Workspace authorization row (Slice 4) |
| **Workspace** | Operating and data boundary (ADR-005, ADR-014) |
| **identityProof** | Current opaque Gateway field. Not Actor authority. Not a specified token format |
| **Pulse identity/account (ADR-014)** | The customer’s one account across Pulse products — **Product** continuity, not “one `auth.users` row for production+V2” |

Do not collapse these.

---

## 4. Actor definition

**Actor** is the **Pulse application principal**. It is **not** the Auth provider record, **not** Workspace, **not** Membership, **not** a JWT.

| Question | Design (recommended) | Status |
|----------|----------------------|--------|
| Is Actor the authenticated identity? | **No.** Authentication yields Auth Subject. Actor is Pulse Identity. | Recommended |
| Is Actor above Auth? | **Yes.** Gateway authorizes Actor, not the raw credential. | Recommended |
| Multiple Auth identities per Actor? | **Not required now.** Abstraction **allows** later linking. Default cardinality: **one Auth Subject → one Actor** | Default 1:1; linking **DEFERRED** |
| One Auth identity → exactly one Actor? | **Yes, default.** An Auth Subject maps to at most one Actor in V2 Identity. | Recommended |
| Lifecycle | Created when V2 Identity **accepts** a verified Auth Subject (bootstrap or first trusted bind). Disable/revoke **membership** independently of Auth expiry. Disable Actor independently of Workspace. | See §12; first-login **OWNER** |
| Workspace-independent? | **Yes (S8).** `actorId` does not change when Membership/Workspace changes. | **DECIDED** (Slice 4 + S8) |
| Exist before authentication? | **Not as a session principal.** Unauthenticated `execute()` has no Actor. Bootstrap/fixture Actors may exist in Identity SoT before a login. | Recommended |
| What is stable? | `actorId` is the stable Pulse principal id for authorization, audit, and future RLS **actor** binding. | Recommended |

Do not assume a Person table.

---

## 5. Auth Subject definition

**Auth Subject** is whatever the **chosen V2 Auth authority** asserts after **server-side validation**: a stable subject string scoped to **that** Auth plane.

It is **not**:

- `request.actorId`
- payload Workspace
- production `auth.users.id` used as V2 authorization (ADR-013)
- permissions, roles, Product access

Provider and subject format (**JWT `sub` vs session id vs other**) are **not** chosen here. OPEN A decides the **relationship**, not the token.

---

## 6. Auth → Actor mapping models

### Model A — Auth Subject = Actor

```text
Auth Subject = actorId
```

Identity ownership sits on the Auth provider’s user id. Pulse Membership keys that same id.

### Model B — Auth Subject → Actor (recommended)

```text
Auth Subject  --trusted bind-->  Actor
```

Pulse Identity owns `actorId`. A mapping (in V2 Identity, behind IdentityPort) binds a validated subject to an Actor. Default **1:1**. Types remain distinct.

### Model C — Auth Subject → Person → Actor

```text
Auth Subject → Person → Actor
```

Adds a Person entity between Auth and Actor. ADR-014 “User / Person” is **Product** language, not a schema mandate. ADR-013 left Person vs `auth.users` **undecided**. No repository requirement that Actor ≠ Person ≠ Auth for Day-1 V2.

**Not recommended for OPEN A** unless Product requires a Person record independent of both Auth and Actor (not evidenced as a V2 requirement).

No additional model is required by current ADRs beyond A/B/C.

---

## 7. Tradeoff analysis

| Concern | Model A | Model B | Model C |
|---------|---------|---------|---------|
| Identity ownership | Auth provider id **is** Pulse Actor | Pulse owns Actor; Auth owns subject | Pulse owns Person and Actor |
| Lifecycle | Actor dies/changes with provider user | Actor can outlive credential/provider change | Three lifecycles |
| Uniqueness | 1:1 by identity of ids | 1:1 bind default; can add binds later | Person 1:N Actor possible — extra product |
| Account recovery | Changing Auth user **changes** Actor id (audit/FK pain) | Re-bind subject; `actorId` stable | Person stable; more tables |
| SSO / federation | New IdP user = new Actor unless ids are forced equal | New subject binds to same Actor (later) | Same, plus Person merge |
| Workspace | Unrelated if ids are global | Unrelated (S8) | Unrelated |
| Security | Provider outage/compromise = identity SoT; harder to refuse a valid Auth user without Pulse row | Pulse can refuse bind / disable Actor while Auth still works | Same as B with more surface |
| Migration | Cheap if never linking | Mapping table later | Heaviest |
| IdentityPort | `resolveActor` returns `subject` as `actorId` — collapses the seam SEC-001 just opened | `resolveActor` maps proof/subject → `actorId` — **matches current port** | Extra resolve hop; port still maps to Actor |
| ADR-013 | Tensions with “must not assume auth.users is application identity” | **Compatible** | Compatible if Person is V2-only |
| ADR-014 one identity | Easy to confuse with one Auth row | One Actor = one Pulse account; Auth may later federate | Person = account; easy to over-model |
| Future RLS | `auth.uid()` = workspace actor if ids equal | Policy needs Actor (and Membership→Workspace), not raw uid alone | Same as B via Person |

Do not rank best/worst. **Recommendation is Model B** because it matches the implemented `resolveActor` seam, SEC-001, ADR-013, and S6 (Auth does not own Pulse authorization), while still allowing **1:1** so Model A’s operational simplicity is available without type collapse.

---

## 8. Recommended architecture

```text
Untrusted request (identityProof / session handle)
        ↓
Gateway + Auth validation (future; not implemented)
        ↓
Trusted Auth Subject (server-validated)
        ↓
IdentityPort.resolveActor(subject-as-opaque-proof)
        ↓
Trusted Actor
        ↓
IdentityPort.resolveMembership(trusted Actor, selector?)
        ↓
Verified Membership → Workspace → AuthorizationContext → Domain
```

**Default cardinality:** one Auth Subject maps to exactly one Actor.  
**Person:** not required.  
**Provider product:** not selected (see §13 / owner list).

If the owner **rejects** Model B and chooses Model A, IdentityPort may still exist but `resolveActor` becomes an identity function — a weaker seam. That is an **owner** choice, not silently applied here.

---

## 9. IdentityPort boundary

**Today (a60aad5a):** `resolveActor(IdentityProof)` with `{ value: string }`; test adapter maps fixture proof → `actorId`. Gateway never uses `request.actorId` as authority.

**Intended future (design):**

1. **Authentication validation** happens **before** or **at the start of** Gateway identity resolution — not in Commerce/Execution. Client-presented material is **untrusted** until the Auth authority validates it.
2. **`resolveActor` accepts a trusted Auth Subject** (still carried as opaque `IdentityProof` so OPEN A does not freeze JWT/session shape).
3. Pulse mapping returns `actorId`. Failure → unauthenticated / no Actor (fail closed).
4. **`resolveMembership` continues to take trusted `actorId` only.**

**What `resolveActor` should not accept as authority:** caller `actorId`, caller Workspace, JWT permission claims, membership id.

**Justification:** Caller cannot manufacture Actor (S1). Opaque proof today is the test stand-in for “not yet validated Auth.” Once Auth exists, **validation is mandatory**; an unvalidated client string must not map to Actor.

Session context vs claims: **DEFERRED** with RLS/JWT (must not decide claims to finish OPEN A). Conceptually the **input to `resolveActor` is a validated subject**, however obtained.

---

## 10. Trust boundary

| Transition | Responsible component |
|------------|------------------------|
| Untrusted request → authenticated session/proof | **V2 Auth** (future) + Gateway admission |
| Validated session → Auth Subject | **V2 Auth** (subject from validated session) |
| Auth Subject → Actor | **V2 Identity** via **IdentityPort.resolveActor** (Gateway-called) |
| Actor → Membership | **IdentityPort.resolveMembership** (Gateway-called) |
| Membership → Workspace | Gateway copies `membership.workspaceId` |
| Context → Domain | Gateway `dispatch` |

Forbidden trusted paths:

```text
Client → Actor
Client → Membership
Client → Workspace
Auth provider → Membership / Workspace / permissions
Production auth.users → V2 AuthorizationContext
```

---

## 11. Ownership model

| Concept | Owner |
|---------|--------|
| Authentication credential | **V2 Auth authority** (isolated; not production Auth as normal path) |
| Auth Subject | **V2 Auth authority** |
| Actor | **Pulse V2 Identity** (`v2_identity` fence; no tables in this design) |
| Membership | **Pulse V2 Identity** |
| Workspace | **Pulse V2 Identity** (entity) / Workspace owns **business data** in domain schemas |
| Role | **Membership** (Slice 4); not Actor |
| Permission | **OPEN B** — not a fourth catalog; not owned by Auth |

Auth authenticates. Pulse authorizes.

---

## 12. Lifecycle

```text
Authenticate
  → Resolve Auth Subject
  → Resolve Actor (map existing bind)
  → Resolve Membership (trusted Actor)
  → Workspace from membership
  → AuthorizationContext
  → Domain / later Product (OPEN B)
```

| Event | Behavior |
|-------|----------|
| First login, no Actor | **OWNER DECISION:** auto-create Actor + bind vs deny until provisioned/invited |
| Actor exists, no Membership | `V2_MEMBERSHIP_DENIED` (already). No Workspace. No domain. |
| Membership revoked/suspended | Deny (existing). Auth may still succeed. |
| Workspace inactive | Not a Slice 4 status field today; **DEFERRED** with Workspace lifecycle. Must fail closed when defined. |
| Auth identity disabled | Validation fails → no Subject → no Actor session. Existing Actor row may remain; no `execute()` context. |
| Actor disabled (future) | Resolve Actor fail-closed even if Auth works |

No provisioning workflow is specified beyond the first-login **owner** fork.

---

## 13. Account linking / federation

| Capability | Now |
|------------|-----|
| 1 Auth → 1 Actor | **Default** |
| N Auth → 1 Actor (linking) | **DEFERRED** — Actor independence is why Model B is recommended |
| SSO / federation / broker to production login | **DEFERRED** (ADR-013: not default; ADR-014 identity **continuity** is Product, not shared `auth.users`) |
| Service / machine identities | **DEFERRED** — same Actor abstraction could bind a non-human subject later; not in scope |

Actor **must remain independent of the Auth provider** so these can be added without rewriting AuthorizationContext.

---

## 14. RLS implications

Do **not** implement RLS. Deny-all stays.

Future policy evaluation (when authorized) needs a **database-visible** fact equivalent to:

```text
trusted Actor + verified Membership → workspace_id
```

It must **not** treat client-supplied Workspace or production `organization_members` as V2 RLS.

**Do not decide JWT claims** here. Options later: session GUC set only by trusted Gateway/Auth path; or claim that is **verified** against Identity SoT each time (Slice 4: do not trust stale token for Workspace). Actor id for audit/RLS must be the **Pulse Actor**, not an unverified client field.

**RLS identity dependency:** **DEFERRED** (plumbing) but **DECIDED** that RLS will key off Pulse Actor/Membership/Workspace, not Auth-as-authorization.

---

## 15. Local V2 implications (ADR-015)

**Can prove locally:** opaque proof → Actor; Actor → Membership → Workspace; AuthorizationContext; fixture multi-Actor / multi-Workspace **isolation** (session still one Workspace context); fail-closed spoof paths; one membership lookup per `execute()`.

**Cannot prove locally:** hosted Auth networking, production federation, remote IdP behavior, production token delivery, hosted ops.

Do not provision hosted V2 to finish OPEN A.

---

## 16. Security invariants

| ID | Invariant | OPEN A |
|----|-----------|--------|
| S1 | Client cannot select Actor | Preserved (SEC-001); Subject→Actor is server-side |
| S2 | Client cannot select Membership as authority | Preserved (selector + actor bind) |
| S3 | Membership verified against trusted Actor | Preserved |
| S4 | Workspace from verified Membership | Preserved |
| S5 | AuthorizationContext Gateway-trusted | Preserved |
| S6 | Auth provider does not own Pulse authorization | **Requires Model B** (or C); Model A weakens S6 |
| S7 | Production Identity not normal V2 authz path | Preserved (ADR-013) |
| S8 | Actor stable independent of Workspace | Preserved |

Quality Charter: one authenticated Actor → one membership resolve per public `execute()` → one Workspace context per session. No org-wide member fan-out, no unbounded Workspace lists, no production Identity queries.

---

## 17. OPEN B dependency

After AuthorizationContext exists, **operation / Product / Experience / capability** checks remain **OPEN B**. Actor/Membership/Workspace do not define the permission catalog. Interface later: Gateway `authorizeOperation(ctx, domain, operation)` with empty permissions until B.

---

## 18. Deferred decisions

| Item | Status |
|------|--------|
| Auth provider product (Supabase Auth vs other) | **DEFERRED** / **OWNER** — requirements only (§7 of prompt) |
| Proof/session/JWT shape | **DEFERRED** |
| Person entity | **DEFERRED** (not required) |
| Account linking N:1 | **DEFERRED** |
| Federation / SSO / broker | **DEFERRED** |
| First-login auto-create Actor | **OWNER** |
| Actor persistence schema | **DEFERRED** (ownership = V2 Identity) |
| RLS claim vs lookup vs session | **DEFERRED** |
| Workspace inactive status | **DEFERRED** |
| Service/machine identities | **DEFERRED** |
| OPEN B | **OPEN** |

---

## 19. Owner decisions required

| # | Topic | This document |
|---|--------|----------------|
| 1 | Auth Subject vs Actor | **Recommended Model B.** Slice 3 recommended Model A. **OWNER must choose.** |
| 2 | Actor lifecycle | Recommended as above; **first-login create vs deny = OWNER** |
| 3 | Auth provider role | Authenticate only; **product not selected** — OWNER when implementing Auth |
| 4 | `resolveActor` contract | Recommended: validated Auth Subject as opaque proof → Pulse `actorId` |
| 5 | Actor uniqueness | Recommended: one Actor per Pulse account; 1:1 Subject→Actor default |
| 6 | Account linking | **DEFERRED** — confirm |
| 7 | Future federation | **DEFERRED** — confirm (ADR-014 continuity ≠ shared production Auth) |
| 8 | Actor persistence ownership | Recommended: **V2 Identity** (`v2_identity`), no schema now |
| 9 | First-login behavior | **OWNER** |
| 10 | RLS identity dependency | Pulse Actor/Membership/Workspace; **plumbing OWNER/Security later** |

Labels:

| Decision | Label |
|----------|--------|
| S1–S8 except S6’s model choice | **DECIDED** (prior slices + this recommendation’s constraints) |
| Model B vs A vs C | **REQUIRES OWNER DECISION** (recommendation: B) |
| First-login | **REQUIRES OWNER DECISION** |
| Linking, federation, provider, JWT, RLS plumbing, Person | **DEFERRED** |
| OPEN B | **DEFERRED / OPEN** |

---

## 20. Recommended next step

**Owner review of Model B** (and first-login). This document **does not authorize** Auth implementation, tables, or Slice 5.

After owner acceptance: architecture for **V2 Auth validation in Gateway** (still local, ADR-015) and **Actor bind persistence design** — separately authorized.

If owner selects Model A, record an explicit supersession of the IdentityPort “proof ≠ actorId” semantic (ids may coincide; Gateway must still not trust `request.actorId`).

---

## Decision register (prompt §19)

| Topic | Status |
|-------|--------|
| 1. Auth Subject vs Actor | **REQUIRES OWNER DECISION** (rec: Model B) |
| 2. Actor lifecycle | **DECIDED** in outline; first-login **OWNER** |
| 3. Auth provider role | **DECIDED** (authenticate only); provider **DEFERRED** |
| 4. `resolveActor` contract | **DECIDED** (recommended): validated subject → Actor |
| 5. Actor uniqueness | **DECIDED** (recommended): 1:1 default |
| 6. Account linking | **DEFERRED** |
| 7. Future federation | **DEFERRED** |
| 8. Actor persistence ownership | **DECIDED** (recommended): V2 Identity |
| 9. First-login behavior | **REQUIRES OWNER DECISION** |
| 10. RLS identity dependency | **DECIDED** (Actor/Membership/Workspace); plumbing **DEFERRED** |

---

## Final status

| Item | Status |
|------|--------|
| SEC-001 | CLOSED |
| Slice 4 runtime | `a60aad5a` — FROZEN |
| OPEN A | **DESIGN READY — OWNER REVIEW REQUIRED** (Model B recommended; not implemented) |
| OPEN B | OPEN |
| Auth implementation | NOT AUTHORIZED |
| RLS | NOT AUTHORIZED |
| Membership persistence | NOT AUTHORIZED |
| Hosted V2 | NOT AUTHORIZED |
| Slice 5 | NOT STARTED |
| Production | UNTOUCHED |

### OPEN A DESIGN READY — OWNER REVIEW REQUIRED
