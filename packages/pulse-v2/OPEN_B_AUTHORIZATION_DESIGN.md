# Pulse V2 — OPEN B Authorization Architecture

**Kind:** Architecture / design only. No implementation.  
**Does not authorize:** RBAC code, permission enum, Gateway changes, RLS, Auth, Slice 5, production.  
**Runtime:** `a60aad5a` **FROZEN**. OPEN A: `5abe24f1` / `OPEN_A_DECISION.md`. SEC-001 **CLOSED**.

---

## 1. Executive decision summary

**Question:** What may this Actor do **inside this Workspace**?

**Answer (architecture, not catalog):**

```text
Validated Auth Subject → Actor (OPEN A Model B)
        ↓
Verified Membership (active) → Workspace
        ↓
AuthorizationContext (Gateway-trusted)
        ↓
Platform authorization (Workspace / Product entitlement / Gateway operation)
        ↓
Domain business authorization (entity + state)
```

| Decision | Status |
|----------|--------|
| Actor existence does **not** authorize | **DECIDED** (OPEN A) |
| Membership is the Actor↔Workspace **authorization bridge** | **DECIDED** (Slice 4) |
| One **session** Workspace context | **DECIDED** (ADR-014) |
| Actor **may** have multiple Memberships (data); session uses **one** | **DECIDED** (Slice 4 uniqueness + ADR-014) |
| Role lives on **Membership**, not Actor | **DECIDED** (Slice 4) |
| No fourth permission catalog | **DECIDED** (Identity Gate D5, Quality Charter P-Q7) |
| `06-permissions.md` | **NOT FROZEN** — cannot be V2 canonical catalog yet |
| Gateway vs domain | **DECIDED:** **Option C** — Gateway: identity + Workspace + coarse platform/operation; Domain: entity + business-state |
| `AuthorizationContext` today | Identity + membership + Workspace + correlation only (runtime). Roles/permissions **not** on the object until mapping exists |
| Permissions in JWT / payload | **Forbidden** as authority |
| OPEN B catalog freeze | **STILL OPEN** — next owner/architecture gate |

This document **does not** freeze Role names, Permission strings, or Product entitlements.

---

## 2. Existing architecture constraints

| Source | Constraint |
|--------|------------|
| ADR-005 / `01-platform-principles.md` | Workspace owns data; Identity authenticates only; Product → Experience → Module → Feature → Entity; products never call products |
| ADR-013 | Production Identity is not V2 authorization authority |
| ADR-014 | One Pulse identity; one authorized Workspace **context** per session; not “one Membership forever” |
| ADR-015 | Local V2-only this phase |
| Identity Gate D3 | Caller `workspaceId` never authority |
| Identity Gate D5 | Role / Permission / Capability / Policy / Entitlement / Operation stay **distinct**; no fourth catalog |
| Slice 4 | Membership `active`; role on membership; permissions resolved at authorize-time, not client list |
| OPEN A | Auth Subject ≠ Actor; create Actor ≠ Membership |
| SEC-001 | Caller `actorId` never Actor authority |
| Quality Charter | Bounded authz; no org fan-out; no Kafka/Redis/mesh/new catalog |
| `06-permissions.md` | **Seed — NOT frozen.** Two production systems + contracts `Permission` **unreconciled** |
| Runtime `AuthorizationContext` | `{ actorId, membershipId, workspaceId, correlationId }` only |

**Authoritative today (V2):** Membership + Workspace on Gateway context; operation = membership `active`.  
**Historical:** Slice 3 Model A (superseded). Production `capabilities.ts` / `PlatformPermission` / `@pulse/contracts` Permission.  
**Unresolved:** freeze/reconcile those three vocabularies; Product Registry vs RBAC; Experience/module/feature granularity.

---

## 3. Identity → Actor → Membership → Workspace

| Concept | Purpose | Authority | Lifecycle owner | May authorize | Must not |
|---------|---------|-----------|-----------------|---------------|----------|
| **Auth Subject** | Who authenticated | Auth system | Auth | Nothing in Pulse | Become Actor or Workspace |
| **Actor** | Pulse principal | Pulse Identity | Pulse Identity | Nothing alone | Grant Workspace or operations |
| **Membership** | Actor is allowed in a Workspace | Pulse Identity | Pulse Identity | **Workspace presence** (if `active`) | Invent data scope or business rules |
| **Workspace** | Operating + data boundary | Pulse | Pulse | **Where** work happens | Be selected by payload |
| **Role** | Named grant set on **this** Membership | Pulse Identity (when catalog exists) | Pulse Identity | Input to permission mapping | Sit on Actor globally; be payload |
| **Permission** | Named allow for a **class of operation** | Mapping (OPEN — existing vocabs) | Not a fourth store | Platform/operation allow | Encode entity id or Workspace id |
| **AuthorizationContext** | Request-scoped trusted facts | Gateway | Gateway (construct) | Carrier for downstream checks | Be client-built or mutated as authority |

```text
Actor ──< Membership >── Workspace
              │
            Role(s)  →  (future mapped) Permission / Capability / Entitlement
```

One Membership per `(actorId, workspaceId)` (Slice 4). An Actor **can** have Memberships in **different** Workspaces. **Session** resolves **exactly one** Membership → one `workspaceId`. Selector `membershipId` is verified against the trusted Actor; it cannot mint access.

Revoked / suspended → no Workspace authorization. No valid Workspace on the membership → deny. Owner of Membership lifecycle: **Pulse Identity** (invite/bootstrap later; not auto on Actor create).

---

## 4. AuthorizationContext model

**Runtime (`a60aad5a`) — keep as identity/tenancy facts:**

| Field | Kind | Why | Authoritative | Created by | Mutate |
|-------|------|-----|---------------|------------|--------|
| `actorId` | Identity | Who | Yes (OPEN A bind) | Gateway via IdentityPort | Must not (SEC-004 still H2) |
| `membershipId` | Membership | Which bind | Yes | Gateway | Must not |
| `workspaceId` | Workspace | Data scope | Yes (from membership) | Gateway | Must not |
| `correlationId` | Request | Provenance | Tracing only | Caller + Gateway copy | Not authz |

**Slice 4 design listed, not in runtime:**

| Field | Recommendation |
|-------|----------------|
| `roles` | **Optional later.** Derived from membership. Do not copy from payload. Prefer resolve-at-check if lists grow. |
| `permissions` | **Do not populate** until catalog freeze. Empty array must **not** mean “allow all.” Missing mapping → **deny** for operation-level checks (fail closed), except today’s **membership-active-only** platform bar. |

**Do not add:** Auth Subject, JWT blob, caller roles, Product flags from the client, entity ids.

**Service vs context:** Coarse “may invoke `commerce.createOrder`” can be a Gateway function `authorizeOperation(ctx, domain, operation)` reading Identity/policy **SoT**, not a stale permission dump. Nested Commerce→Execution already shares **one** context — do not rebuild permission lists per hop.

---

## 5. Role model

**Supported by existing architecture (not a new invention):**

```text
Actor → Membership → Role(s) → (mapped) Permission(s)
```

Role is **not** the primary *Workspace* check (Membership status is). Role is the primary *operation-class* abstraction **once** the catalog is frozen.

| Alternative | Verdict |
|-------------|---------|
| Role-based (via Membership) | **Matches Slice 4 + PlatformPermission + contracts ROLE_PERMISSIONS** |
| Direct membership permission lists | Rejected as **client-editable authority** (Slice 4) |
| Capability-only (`lib/capabilities.ts`) | Production UI gating; **not** V2 SoT; client derivation is a known weakness |
| Role + exceptions | **OPEN** — no V2 requirement yet |

Do **not** treat “RBAC” as implemented. Treat **Membership Role → mapped grants** as the intended **shape**. Exact roles: **OPEN**.

---

## 6. Permission model

**Permission** = named allow for a **type of action**, evaluated **inside** an already-trusted Workspace.

| Question | Layer |
|----------|--------|
| Who? | Actor (OPEN A) |
| Where? | Workspace (Membership) |
| What class of action? | Permission / Capability / Gateway **operation** (unreconciled vocabs) |
| What entity / state? | Domain |

**Existing catalogs (do not add a fourth):**

1. `docs/architecture/platform/06-permissions.md` — **not frozen**
2. `lib/capabilities.ts` — `Capability` / operating-model flags
3. `PlatformPermission` — admin-delegation
4. `@pulse/contracts` `Permission` — `org:read`, `commerce:*`, … (Hono/JWT-oriented)

Until Product/Architecture **freezes mapping**, V2 must **not** pick one enum as canonical and must **not** invent `V2Permission`.

Gateway **operations** (`commerce.createOrder`) are the V2 **invocation surface**. Mapping operation → existing Permission/Capability is **OPEN B remainder**.

---

## 7. Product / Experience authorization

Layer 1:

```text
Workspace → Product → Experience → Module → Feature → Entity
```

| Layer | Question | Day-1 V2 | Later |
|-------|----------|----------|--------|
| Workspace | May Actor operate here? | Membership `active` | Same |
| Product | Is Product enabled for Workspace? | Product Registry / activation (existing concept; not redesigned) | Actor-scoped entitlement if Product requires it |
| Experience | Persona/device UI | Not a V2 runtime surface yet | Experience allow, not a new catalog |
| Module / Feature | Fine-grained UI/actions | **Do not explode** Day-1 permissions | Map to Gateway operations / capabilities |
| Entity | This row? | Domain + `workspace_id` | Same |

**Avoid hundreds of bespoke permissions:** prefer **Workspace membership + Product activation + small operation set + domain rules**. Feature flags are not a permission catalog.

---

## 8. Domain authorization

```text
Request → Gateway → AuthorizationContext → Domain
```

Domains **must not:** resolve Auth Subject; authenticate; trust caller `actorId` / `workspaceId`; query production membership; own a permission enum; invent tenancy.

**Minimum a domain needs:** trusted `workspaceId`, `actorId` (audit / actorUserId), `correlationId`. Operation already admitted by Gateway (or explicitly re-checked).

Domains **must:** Workspace-scoped persistence; business transitions; not leak other Workspaces’ rows.

---

## 9. Business authorization

| Kind | Examples | Owner |
|------|----------|--------|
| **Platform** | Access this Workspace? Product X enabled? Invoke Gateway operation Y? | Gateway + Identity / Product Registry |
| **Business** | Approve settlement? Dispatch trip? Edit order after dispatch? Amount threshold? | **Owning domain** application rules |

Gateway must **not** encode Finance thresholds or trip state machines. That would break domain ownership and future extraction.

---

## 10. Entity / data authorization

Do not collapse:

| Check | Meaning |
|-------|---------|
| **Workspace** | Actor’s Membership is `active` for this Workspace |
| **Entity** | Row’s `workspace_id` equals trusted Workspace (and domain ownership) |
| **Business-state** | Aggregate allows the transition (e.g. order not already dispatched) |

A permission `commerce.write` does **not** imply every entity in every state.

---

## 11. Cross-domain authorization

Law #3: products don’t call products. V2: domains don’t query foreign tables. Commerce → Execution uses **Gateway nested `dispatch` with the same `AuthorizationContext`**.

No second Actor/Membership resolve. No payload Workspace override. No new bypass. Future extraction: pass the **same trusted context** (or equivalent signed internal token **later** — not designed here; no mesh/Redis/Kafka).

---

## 12. Deny-by-default

| Condition | Result |
|-----------|--------|
| Unknown / unbound Actor | Deny (`V2_UNAUTHENTICATED` / resolve fail) |
| Unknown Membership | `V2_MEMBERSHIP_DENIED` |
| Membership of another Actor | Deny (selector / bind check) |
| Membership of another Workspace vs payload | `V2_WORKSPACE_DENIED` if payload mismatches; context never uses payload |
| Revoked / suspended | Deny |
| Missing permission / unknown permission (once checks exist) | **Deny** (never treat empty catalog as allow-all) |
| Malformed context | Deny / fail-stop — do not dispatch |
| Missing Workspace | Deny |
| Missing authorization decision when operation-level checks are **enabled** | Deny |
| Stale token Workspace claim | Re-verify Membership (Slice 4); do not trust JWT for Workspace |
| Actor exists, no Membership | Deny data-plane (OPEN A) |

Default: **DENY**.

---

## 13. One-Workspace context

ADR-014: one authorized Workspace context per **active V2 session**. No simultaneous contexts, no implicit switch, no cross-Workspace operations, no client Workspace authority.

Multiple Memberships in **Identity data** remain allowed for tests and future switching (**separate Product decision**).

---

## 14. Future service extraction

In-process Gateway remains Day-1. If Identity / Execution / Commerce / Finance later split, authorization that **must** cross the boundary is the **trusted context** (Actor, Membership, Workspace, correlation) plus a **server-side operation allow** — not a client permission list.

No service mesh, OPA, Redis cache, or Kafka authz bus. Quality Charter forbids them unless a later evidence ADR.

---

## 15. RLS relationship

Deny-all until Auth + Membership SoT exist.

Future: **application authorization is authoritative for operations**; **RLS is defense-in-depth** for `workspace_id = trusted Workspace` (and must not contradict Gateway). Plumbing (claims vs lookup vs session) **OPEN**. Must not use production `auth.uid()` / `organization_members` as V2 RLS. Must not use client GUC.

---

## 16. Security considerations

- Payload `role` / `permission` / `workspaceId` / `actorId` / `membershipId` are **never** authority.
- Empty `permissions` on context ≠ superuser.
- Client-derived capabilities (production lesson) are **not** V2 SoT.
- Nested path must not re-authorize a **different** Actor.
- Bounded: no org-wide member fan-out for a permission check.
- Fail closed on IdentityPort throw remains SEC-006 (deferred hardening).

**Contradiction check (this design):**

1. Auth Subject = Actor? **No.**  
2. Caller Workspace authority? **No.**  
3. Fourth catalog? **No.**  
4. Multiple session Workspaces? **No.**  
5. Gateway owns business rules? **No** (Option C).  
6. Premature microservices? **No.**  
7. Actor exists ⇒ allow? **No.**

---

## 17. Open questions

1. **Exact permission catalog** — reconcile `06-permissions.md` / `Capability` / `PlatformPermission` / contracts `Permission`; then freeze.  
2. **Role structure** — names, cardinality (one vs many roles per Membership).  
3. **Product/Experience granularity** — activation only vs Actor entitlements.  
4. **Entity-level authorization** beyond Workspace scope (resource ACLs) — not required by current V2 domains.  
5. **Business-state authorization** catalog vs domain code — default **domain code**.  
6. **Permission inheritance** (Workspace → Product → Feature) — **OPEN**.  
7. **Explicit deny vs allow-only** — Slice 4 is allow-only + fail closed; explicit deny lists **OPEN**.  
8. **Authorization caching/invalidation** — none; Charter forbids global invalidation; per-request Membership read.  
9. **Membership / role lifecycle** (invite, pending, transfer) — deferred.  
10. **Service-to-service authorization** after extraction — deferred; same context, no new bus.

---

## 18. Explicit non-decisions

- Auth provider, JWT, session, `auth.uid()`, RLS SQL  
- Membership persistence schema  
- Hosted V2, Slice 5, production Identity  
- Freezing `06-permissions.md`  
- New V2 permission enum  
- Account linking, federation  
- Multi-Workspace switching  
- Policy engines / mesh / Redis / Kafka  

---

## 19. Recommended next decision

**Single next architectural gate:**

> **Reconcile and freeze the existing permission vocabularies** (`06-permissions.md` + `Capability` + `PlatformPermission` + `@pulse/contracts` Permission) **or** explicitly document a **permanent layered boundary** among them — **without creating a fourth catalog**.

Until that freeze (or layered-boundary ADR), V2 operation RBAC **cannot** be implemented as production-grade rules. Platform bar remains **Membership `active`**.

Do **not** implement Gateway `authorizeOperation` bodies against a guessed enum.

---

*No runtime, tests, migrations, Auth, RLS, or production files were modified for this design.*
