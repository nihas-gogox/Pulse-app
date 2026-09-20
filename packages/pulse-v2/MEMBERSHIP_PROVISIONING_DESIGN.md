# Pulse V2 — Membership Provisioning Architecture

**Kind:** Design only. Does **not** authorize tables, IdentityPort changes, Gateway, Auth, or production.  
**Runtime:** `a60aad5a` **FROZEN**. Product gating: not required (`2a48eecd`). OPEN A: Actor without auto-Membership.

---

## 1. Executive decision

### DESIGN COMPLETE (provisioning **authority shape** + lifecycle)

**Membership is an Identity grant**, not a side effect of authentication or Actor creation.

```text
Actor exists + no Membership  →  no Workspace  →  no data-plane
```

**Provisioning model (evidence-based combination — Model E):**

| Path | When | Authority |
|------|------|-----------|
| **First Membership** | A **Workspace is created** | Pulse Identity: creating Actor receives **one** Membership `active` for **that** Workspace (production analogue: `handle_new_user` org+membership). **Not** OPEN A first-login. |
| **Additional Memberships** | Join an **existing** Workspace | Existing **`PlatformPermission` `members.invite`** semantics (admin/delegation). **Invitation protocol deferred.** |
| **Self-join by `workspaceId`** | — | **Forbidden** |

**Invitation:** **DEFERRED** (Slice 4: not required; `pending` only if invites exist).  
**Who may create a Workspace:** **OPEN — next gate.** Without that, the first-Membership path cannot be implemented.

No Product/Capability/permission catalog is assigned at provision time.

---

## 2. Membership definition

Minimum conceptual Membership (Slice 4 + runtime `MembershipRecord`):

| Fact | Required |
|------|----------|
| `membershipId` | Yes |
| `actorId` | Yes |
| `workspaceId` | Yes |
| `status` | Yes — `active` \| `suspended` \| `revoked` |
| Role | Yes **conceptually** (on Membership, names **OPEN**). Not on runtime record today. |

Uniqueness: **one Membership per (`actorId`, `workspaceId`)**.

`active` = may operate in that Workspace **now**. It does **not** mean authenticated, Actor exists, account owner, Product enabled, Capability, or Role-alone.

---

## 3. Actor → Membership → Workspace

- **Cardinality:** Actor **1 → N** Memberships (data). Session: **one** authorized Workspace context (ADR-014).  
- **Not** “Actor belongs to only one Workspace forever.”  
- **No** simultaneous Workspace contexts.  
- Caller `workspaceId` never creates or selects authority.

```text
Actor ──< Membership >── Workspace
              ├── status
              └── Role (names OPEN)
```

---

## 4. Membership lifecycle

**Accepted states (already in V2 IdentityPort):** `active` | `suspended` | `revoked`.

**`pending`:** **Not required** until invitations. Slice 4: optional only if invites are later required.

| Transition | Cause (architecture) | Owner |
|------------|----------------------|--------|
| — → `active` | First Membership on Workspace create; or admin/invite accept (future) | Pulse Identity |
| `active` → `suspended` | Administrative freeze | Identity; conceptually `members.remove` / admin — **exact op OPEN** |
| `active` → `revoked` | Permanent removal | Identity |
| `suspended` → `active` | Administrative restore | Identity — **allowed in concept**; not implemented |
| `revoked` → `active` | **OPEN** — do not assume reuse of same `membershipId`; uniqueness may require a **new** Membership row |

Gateway **re-reads** Membership each public `execute()` (Slice 4). Inactive → deny. No V2 AuthorizationContext cache across requests.

---

## 5. Provisioning authority

**Repository evidence**

| Source | Pattern |
|--------|---------|
| `handle_new_user()` | Auth user → profile; **owner onboarding** creates **organization + membership** |
| `platformIdentityService.acceptInvitation` | Invite → policy → membership |
| `PlatformPermission` `members.invite` | Who may invite (not domain RBAC) |
| Slice 4 | Invites **deferred**; no self-tenancy |

**Not chosen:** generic SaaS-only Model A or B in isolation.

**V2:**

- **Model C** for **bootstrap** of a **new** Workspace (first Membership).  
- **Model A** (admin using **existing** `members.invite` **concept**) for **further** members **when** those Gateway operations exist.  
- **Model B** invitations: **deferred**.  
- **Model D** enterprise/SCIM: **deferred**.

Commerce/Execution/Finance/Network **must not** create Memberships.

---

## 6. First Workspace / first Membership

**Existing Workspace:** Actor needs a Membership created by Identity (invite/admin). Cannot POST `workspaceId`.

**New Workspace (recommended, not implemented):**

```text
Verified Actor (no Membership required to *authenticate*)
  → Identity: Create Workspace   [WHO MAY DO THIS = OPEN]
  → Identity: Create Membership { actor, workspace, active, Role TBD }
  → resolveMembership → AuthorizationContext
```

This does **not** violate OPEN A: first **authentication** still does not create Membership; **Workspace creation** does.

If Workspace create is **disallowed** for ordinary Actors, first Membership exists **only** via out-of-band/admin provisioning — also **OPEN**.

---

## 7. Invitation model

**DEFERRED.**

Production has invitations (`organization_team_invites`, `acceptInvitation`, `members.invite`). Slice 4: not required. No V2 Experience.

When later designed (not now): invite must bind **intended identity** (not caller-chosen Actor); grant Role on Membership; revocable; accept after Auth Subject → Actor bind; cannot mint Workspace via payload. Target identifier (email vs Subject) **OPEN**.

---

## 8. Role assignment

Role is assigned **when Membership is created**, stored on Membership, **not** chosen by the Actor as a privileged self-service field.

Activation does not require a second Role step. Names **unfrozen** (`admin|planner|operator` not copied as V2 law).

---

## 9. Membership.active semantics

**Yes:** this Actor may operate in this Workspace for **this** `execute()`.

**No:** Auth success; Actor row; “I created my account”; Product; Capability; Role string without `active`.

---

## 10. Membership selector

Preserve Slice 4 / `memoryIdentityPort`:

| Case | Result |
|------|--------|
| Omitted, one `active` | That Membership |
| Omitted, several `active` | `ambiguous` deny |
| Omitted, none active | `not_found` or `inactive` |
| Set, not this Actor | `invalid_selector` |
| Set, this Actor, not active | `inactive` |
| Selector required? | **Optional** |

Selector cannot mint access. Session still one context.

---

## 11. Revocation

**Invariant:** inactive Membership **must not** authorize **new** data-plane `execute()`.

Today: each public `execute()` resolves Membership; nested hops reuse **that request’s** context (do not re-check mid-tree — Slice 4). Next public request fails closed.

No V2 UI / long-running jobs / distributed cache. Future extraction: same invariant; no invalidation bus in this design.

---

## 12. Workspace authority

Trusted path: Actor → Membership → `membership.workspaceId`. Payload `workspaceId` mismatch → `V2_WORKSPACE_DENIED`. Provisioning **must not** treat request Workspace as grant.

---

## 13. Identity ownership

**Pulse Identity** (`v2_identity` fence). Not Commerce, Execution, Finance, Product, Driver, Network. Domains consume `AuthorizationContext` only.

Future seam: Identity capability **before** `resolveMembership`, not a domain operation. **Do not change IdentityPort in this gate.**

---

## 14. Security model

| Threat | Control |
|--------|---------|
| Self-authorized Workspace | No Membership from caller `workspaceId` |
| Self-assigned Role | Role set only by Identity provisioning path |
| Cross-Actor invite abuse | Deferred invites must bind intended identity |
| Revoked reuse | Status + per-`execute()` resolve |
| Cross-Workspace | Membership Workspace only |
| Actor spoof | OPEN A / SEC-001 |

PlatformPermission **`members.invite`**: existing **admin** concept for **adding members**, not for Commerce/Execution ops, not a new permission. Do not use it to bootstrap **self** Membership on an arbitrary Workspace.

---

## 15. Conceptual data model

```text
Actor
  ├── Auth Subject binding (1:1 default)
  └── Membership(s)
        ├── Workspace
        ├── status: active | suspended | revoked
        └── Role (names OPEN)
```

No schema, no `pending` until invites.

---

## 16. Future implementation seam

```text
Validated Auth Subject → resolveActor()
  → [Identity: provision Membership only via create-Workspace or admin/invite]
  → resolveMembership(trusted Actor, selector?)
  → AuthorizationContext → Gateway
```

Tests today **fixture** Memberships; that is not production self-serve.

---

## 17. Open questions

1. **Who may create a Workspace?** (first Membership)  
2. First Membership Role value (names OPEN)  
3. Invitation now vs later; invite target identity  
4. `revoked` reactivation vs new row  
5. Exact admin op for suspend/revoke  
6. Ownership transfer of Workspace  
7. Enterprise / SSO / SCIM provisioning  
8. Service-to-service “membership”  
9. Multiple Membership UX (switcher deferred)  

---

## 18. Explicit non-decisions

Auth provider, JWT, RLS, SQL, hosted V2, production Identity, SSO/SCIM implementation, role names, permission catalog, Product gating, Capability, service-to-service authz.

---

## 19. Recommended next gate

**Workspace creation authority** — which verified Actor (if any) may create a V2 Workspace and thereby receive the **first** `active` Membership.

Until that is decided, Membership implementation would only be **fixtures** or **unspecified bootstrap**.

---

### Validation checks

1 Actor create ≠ Membership — **pass**  
2 Membership = Workspace bridge — **pass**  
3 Identity-owned — **pass**  
4 Role on Membership — **pass**  
5 Caller workspaceId ≠ authority — **pass**  
6 Inactive ≠ new execute allow — **pass**  
7 No Product/Capability via provision — **pass**  
8 No fourth catalog — **pass**  
9 One session Workspace context — **pass**  
10 Production untouched — **pass** (docs only)

