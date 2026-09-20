# Pulse V2 — Workspace Creation Authority

**Kind:** Owner decision / design only. No implementation.  
**Membership provisioning:** `9de16f3e`. **Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Executive decision

### Outcome A — ANY AUTHENTICATED ACTOR MAY CREATE A WORKSPACE

```text
Verified Actor (OPEN A bind)
      ↓
Authorized operation: create Workspace
      ↓
Identity creates Workspace (id not caller-chosen as authority)
      ↓
Identity creates exactly one Membership { actor, workspace, active, Role OPEN }
      ↓
Actor may operate in that Workspace (Membership.active + domain)
```

**No** existing `PlatformPermission` is required (none means “create Workspace”).  
**No** prior Membership is required (that would block the first Workspace).  
**No** enterprise/SCIM path is required for current V2 (ADR-015).  
Authentication **alone** does not create a Workspace; the Actor must invoke the **create Workspace** operation.

---

## 2. Workspace definition

Workspace = V2 **operating and data boundary** (ADR-005, ADR-014). Creation establishes:

```text
Workspace (Identity-issued id)
+ creating Actor
+ first Membership.active
```

**Not required now** (no V2 requirement): Workspace type, billing, subscription, Product selection, Organization mapping, Tenant.

**May exist later as Identity metadata:** display name — not authorization.  
**Initial Role:** assigned on first Membership; **name OPEN**.

Product entitlement is **not** part of Workspace creation (`PRODUCT_EXPERIENCE_GATING_DECISION.md`).

---

## 3. Workspace vs Organization vs Tenant

| Concept | This gate |
|---------|-----------|
| **Workspace** | V2 authority and data scope |
| **Organization** | Production entity; **not** V2 create-Workspace authority; mapping is cutover later |
| **Tenant** | May sit above Workspace later; **not** in create path now |

Forbidden: `public.organizations` / `organization_members` as V2 create or Membership SoT.

---

## 4. Workspace creation lifecycle

```text
Auth Subject → Actor
  → create Workspace (this decision: any verified Actor)
  → Identity: persist Workspace + first Membership  [atomic conceptually]
  → later execute(): resolveMembership → AuthorizationContext
```

Workspace **id** comes from Identity, not as Membership authority from `request.workspaceId`.

---

## 5. Candidate authority models

| Model | Verdict |
|-------|---------|
| **A** Any authenticated Actor | **Selected** |
| **B** PlatformPermission | **Rejected** — no existing permission is Workspace create; inventing one is a new catalog entry |
| **C** Existing Membership | **Rejected** — contradicts first-Workspace lifecycle |
| **D** Enterprise/admin only | **Rejected for now** — no V2 requirement; SCIM/SSO deferred |
| **E** Hybrid | **Rejected for now** — extra paths without evidence |

---

## 6. Repository evidence

| Evidence | Implication |
|----------|-------------|
| `handle_new_user` + owner signup | **Self-serve first org+membership** after auth; not `PlatformPermission` |
| Team/invite signup | Profile-only; Membership via invite — **other path**, deferred for V2 |
| `PlatformPermission` list | invite/remove/view, org settings/archive, SSO, billing, policy — **admin of an existing org**, not create |
| Hono `organizations:create` | **contracts `Permission`**, Hono-only, **not** V2 Gateway catalog |
| Slice 4 / OPEN A | Actor ≠ Membership; first Membership with Workspace create |
| ADR-015 | Local V2; no hosted enterprise provisioner |
| ADR-014 | One session Workspace context; does **not** forbid creating a Workspace |
| Identity Gate | Workspace ≠ Organization |

---

## 7. Selected authority model

**Any Pulse Actor with a successful Identity bind** may call **create Workspace**.

Not: any anonymous caller; not production `auth.users`; not payload `workspaceId`.

Rate-limiting / abuse: **out of this gate** (ops), not a permission.

---

## 8. First Membership creation

Identity **must** create **exactly one** `active` Membership for the **creating Actor** and the **new** Workspace. Not for Actor B. Not from caller Workspace id.

**Atomicity (architectural):** Workspace + first Membership succeed **together** or **neither** persists. Do **not** leave `Workspace exists + no Membership` without a recovery model — **none is defined**, so **require atomic success**. Transactions are an implementation detail later.

---

## 9. Role assignment

First Membership **receives a Role** at creation (Membership provisioning). **Initial Role = OWNER-DEFINED / OPEN.** Do not freeze `admin|planner|operator`. Caller cannot submit `role=` as authority.

---

## 10. PlatformPermission relationship

**Does not apply** to create Workspace. `members.invite` governs **additional** members of an **existing** Workspace later. Do not stretch `organization.settings` to mean create.

---

## 11. Product / Capability relationship

**NONE.** No Capability, Product activation, Commerce/Execution entitle, or Product Membership.

---

## 12. Security invariants

| Threat | Control |
|--------|---------|
| Self-assigned Workspace id | Id issued by Identity; payload id ≠ grant |
| Self-assigned Membership | Only Identity create-Workspace (or later invite) |
| Self-assigned Role | Role not caller authority |
| Cross-Workspace | New Membership only for **new** Workspace |
| Cross-Actor first Membership | Creating Actor only |
| Duplicate first Membership | Exactly one on create |
| Actor-less Workspace | Forbidden by atomic Membership |

Actor create still does **not** create Membership (OPEN A).

---

## 13. Failure / atomicity

| Case | Result |
|------|--------|
| Actor authenticated, create denied (future policy) | No Workspace |
| Create Workspace succeeds, Membership fails | **Must not commit** Workspace-only; treat as failed create |
| Membership resolve later | Per-`execute()`; inactive ≠ allow |

---

## 14. Multiple Workspaces

An Actor **may** create **another** Workspace later (another Membership). Session still **one** context. Selector / ambiguous rules unchanged. **No** switcher UX in this gate.

---

## 15. Enterprise / invitation future

Keep **separate**: self-serve create (this decision); `members.invite` (deferred protocol); SSO/SCIM (deferred). Do not merge into one mechanism now.

---

## 16. Explicit non-decisions

Schema, Auth/JWT/RLS, hosted V2, SSO/SCIM, Role names, Product entitlement, production org migration, switcher UX, rate limits, Gateway operation name for create.

---

## 17. Next gate

**Identity `createWorkspace` contract** — how a verified Actor invokes Identity-owned create (operation surface, request/response, still **no** tables/migrations). Not Slice 5. Not Auth provider.

---

### Validation

1 Actor ≠ Membership — **pass**  
2 Workspace create = first Membership — **pass**  
3 Self-join `workspaceId` **FORBIDDEN** — **pass**  
4 Workspace = V2 boundary — **pass**  
5 Organization ≠ authority — **pass**  
6 Product gating out — **pass**  
7 Role on Membership — **pass**  
8 No fourth catalog — **pass**  
9 Multiple Memberships in data — **pass**  
10 One session context — **pass**  
11 Production untouched — **pass** (docs)

