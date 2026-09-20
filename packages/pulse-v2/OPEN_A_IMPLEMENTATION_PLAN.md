# Pulse V2 — OPEN A Implementation Plan

**Kind:** Plan only. **Implementation is NOT authorized** by this document.  
**Decision:** `OPEN_A_DECISION.md` — Model B, 1:1, first-login create Actor, no auto-Membership.  
**Runtime:** `a60aad5a` remains **FROZEN** until a later, explicit code authorization.

---

## 1. Current architecture

```text
execute(request)
  → resolveActor({ value: request.identityProof })     // opaque; test fixture
  → deny if request.actorId ≠ trusted Actor
  → resolveMembership(trusted Actor, membershipId?)
  → deny if membership.actorId ≠ trusted Actor
  → deny if payload.workspaceId ≠ membership.workspaceId
  → AuthorizationContext
  → dispatch (nested = same ctx; no second lookup)
```

Evidence: `src/gateway/pulseV2Gateway.ts`, `src/identity/identityPort.ts`, `memoryIdentityPort.ts`.

SEC-001 closed: caller `actorId` is not authority. Commerce/Execution unchanged. Deny-all RLS. No V2 Auth.

---

## 2. Accepted decisions

| Item | Decision |
|------|----------|
| Mapping | **Model B** — Auth Subject binds to Actor |
| Identity | Auth Subject ≠ Actor |
| Cardinality | 1 Auth Subject → 1 Actor |
| Person | Not required |
| First login | Create Actor after successful authentication |
| Membership | **Not** auto-created |
| Principle | Auth authenticates; Pulse authorizes |
| Linking / federation | Deferred |

---

## 3. Identity boundary

| Concept | Owner |
|---------|--------|
| Credential / Auth Subject | Auth system (future; isolated V2, not production) |
| Binding / Actor / Membership | Pulse Identity |
| Workspace (entity) | Pulse |
| AuthorizationContext | Gateway |
| Permissions | OPEN B |

Auth validation **must not** live in Commerce or Execution.

---

## 4. Auth Subject → Actor binding

Conceptual information (no schema now):

| Fact | Need |
|------|------|
| Auth subject identifier | Stable string from **validated** Auth (format **not** chosen) |
| Actor identifier | Pulse `actorId` |
| Binding status | `active` (and later `revoked` if unbind is required) |
| Creation timestamp | Audit / first-login uniqueness |

Uniqueness under current model: **one binding per Auth Subject**; **one Actor per Subject**. Do not add provider, Person, or N:1 link tables.

Revocation of Auth (IdP disable) is Auth-plane: no valid Subject → no `execute()` context. Binding/Actor rows may remain; they do not authorize without Membership.

---

## 5. First-login lifecycle

| Case | Future behavior |
|------|-----------------|
| Auth OK, no binding | Pulse Identity **creates Actor** + **active bind**; then Membership resolve |
| Auth OK, binding exists | Resolve that Actor (same `actorId` on repeat login) |
| Auth OK, Actor create fails | **Fail closed** — no context, no domain |
| Actor, no Membership | Authenticated identity, **`V2_MEMBERSHIP_DENIED`** (or equivalent) — **no Workspace, no data-plane** |
| Membership revoked / inactive | No authorized Workspace |
| Workspace inactive | When Workspace lifecycle exists: **fail closed** (not a Slice 4 field today) |

Actor creation = identity provisioning, **not** authorization (S6).

---

## 6. IdentityPort evolution

**Keep** `resolveActor` as the Gateway-facing Actor abstraction.

| Question | Plan |
|----------|------|
| Public abstraction? | **Yes** — `resolveActor` remains |
| Input? | Eventually a **trusted Auth Subject** (may still travel as opaque `IdentityProof` so JWT/session stay undecided) |
| Where is Auth validated? | **Before** `resolveActor`: Gateway (or injected Auth validator). Client proof is untrusted until then |
| Where is Subject extracted? | Auth validation result — not `request.actorId` |
| Where is binding resolved / first-login create? | **Pulse Identity** behind IdentityPort (not the client, not domain handlers) |
| How Gateway gets Actor | Solely `resolveActor` success → `actorId`; then existing `resolveMembership` |

Do **not** choose Auth provider, JWT shape, session mechanism, or claims.

Optional later split (not required for first authorized cut): `ensureActor(subject)` wrapping lookup-or-create, still only after validation.

---

## 7. Membership integration

Unchanged Slice 4 rules:

- `resolveMembership({ actorId: trustedActor, membershipId? })`
- Selector must belong to that Actor
- Workspace = `membership.workspaceId`
- No Membership → deny data-plane

Do not auto-insert Membership on first login.

---

## 8. Gateway integration

Target:

```text
Client → Authentication → Validated Auth Subject
  → IdentityPort (bind / create Actor)
  → resolveMembership
  → Workspace → AuthorizationContext → Domain
```

Nested `dispatch(inner, ctx)` **unchanged**. Do not re-resolve Actor on nested Commerce → Execution.

Preserve one membership lookup per **public** `execute()`. First-login may add **one** bind lookup + at most **one** Actor create on that same public execute — not org fan-out.

---

## 9. Local testing (ADR-015)

Provable without hosted Auth:

- Fixture Auth Subject (opaque, not JWT)
- Bind Subject → Actor
- First login creates **exactly one** Actor
- Repeat login same Actor
- No Membership → no Workspace
- Revoked Membership → deny
- Cross-Actor membership selector → deny
- Workspace still from membership; payload W2 denied
- Caller `actorId` still `V2_ACTOR_DENIED`

Not provable locally: hosted Auth, production federation, remote IdP, production token delivery.

---

## 10. Security tests (when implementation is authorized)

| Test | Expected |
|------|----------|
| Caller chooses Actor | Deny (SEC-001) |
| Subject S1 → Actor A | Context Actor A |
| First login | Exactly one Actor + one bind |
| Second login same Subject | Same Actor |
| Second Subject | Different Actor (1:1) |
| No Membership | Deny Workspace / no domain data |
| B’s membership on A | Deny |
| Payload Workspace W2 | `V2_WORKSPACE_DENIED` |
| Nested createTrip | Same ctx; one membership lookup |
| Create Actor fails | Fail closed |
| Auth validation fails | No Actor, no domain |

S1–S8 in `OPEN_A_DECISION.md` / owner prompt must hold.

---

## 11. Deferred decisions

Still **blocked** without a separate decision/authorization:

- Production Auth / `auth.users` / `organization_members`
- Hosted Auth / hosted V2
- JWT / session / claims / `auth.uid()`
- Auth provider selection
- RLS policy SQL (deny-all stays)
- Persistent production Identity; V2 table migrations until authorized
- Federation, linking, SSO, SCIM
- OPEN B
- Production cutover
- Slice 5

---

## 12. Implementation stages

Derived from the **current** Gateway + IdentityPort (not a greenfield stack).

| Stage | Intent | Touches | Depends | Stop if |
|-------|--------|---------|---------|---------|
| **1 — Contracts** | `AuthSubject` type; binding result types; IdentityPort: lookup-or-create Actor from **trusted** subject; keep `resolveMembership` | `src/identity/*`, comments on Gateway types | Owner authorizes **code** | Provider/JWT sneak in |
| **2 — Local Identity** | Memory adapter: fixture subjects, 1:1 bind, first-login create, create-fail path | `memoryIdentityPort.ts` + tests | Stage 1 | SQL/migrations |
| **3 — Membership** | Existing membership path + explicit no-Membership after new Actor | Tests; no Commerce/Execution | Stage 2 | Auto-Membership |
| **4 — Gateway** | After (future) Auth validation, pass trusted subject into `resolveActor`; keep spoof deny; nested ctx | `pulseV2Gateway.ts` | Stage 2–3; Auth validator still may be a **test double** | Client `actorId` as create input |
| **5 — Security tests** | §10 | `tests/authorization.test.ts` (+ focused bind tests) | Stages 1–4 | Weakening SEC-001 |

**Do not** skip to hosted Auth, RLS, or OPEN B.

Stage 4 may use a **local Auth fixture** (ADR-015) instead of a real provider — provider remains deferred.

---

## 13. Stop conditions

Stop and return to owner if implementation would:

- Set `actorId = Auth Subject`
- Auto-create Membership
- Query production Identity
- Introduce JWT claims as Workspace/Actor authority
- Change RLS off deny-all
- Add linking / Person / Slice 5
- Modify production or Expo

---

## 14. Owner decisions still required

| Topic | Status |
|-------|--------|
| Model B, 1:1, first-login create Actor | **ACCEPTED** |
| Authorize **any** of stages 1–5 as code | **Not authorized** by this plan |
| Auth provider / JWT / session | **Still required** before real Auth |
| RLS plumbing | **Still required** before policies |
| Federation / linking | **Deferred** |
| OPEN B | **Open** |
| First-login **Membership** (invites, default Workspace) | **Not decided** — must stay off |

---

## Quality Charter

Bounded: one Subject bind + one membership resolve per public `execute()`. No org member fan-out. No production Identity. Fail closed. Observable `correlationId`.

---

*This plan does not modify `a60aad5a`.*
