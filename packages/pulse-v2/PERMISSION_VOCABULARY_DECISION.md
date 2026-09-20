# Pulse V2 — Permission Vocabulary Reconciliation

**Kind:** Architecture reconciliation only. No implementation.  
**OPEN B:** `OPEN_B_AUTHORIZATION_DESIGN.md` (`756b8fc7`) — Option C.  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Executive decision

### PERMISSION VOCABULARY FREEZE — BLOCKED

Repository evidence is **sufficient to permanently layer** existing vocabularies and **insufficient to freeze a single canonical permission enum** (or to pick `admin|planner|operator` / `Capability` / `PlatformPermission` as the only V2 grant set).

**Do not invent a fourth catalog.** **Do not merge** the three named systems in `06-permissions.md` into one list. They are **different layers**.

| Outcome | Meaning |
|---------|---------|
| **Layering** | **DECIDED** (this document) — Identity Gate D5 shape, grounded in code |
| **Canonical strings / role names for V2 RBAC** | **BLOCKED — OWNER** (`06-permissions.md` still Seed; production roles already diverged from contracts `PlatformRole`) |
| **New catalog** | **NONE** |

**Owner must decide** (next gate): mapping from **V2 Gateway operations** onto **which existing grant layer(s)** — without adding names — and whether Hono `@pulse/contracts` `Permission` is **in-scope for V2** or **Hono-only (historical for V2)**.

---

## 2. Existing vocabulary inventory

| Vocabulary | Location | Purpose | Current status | Used by runtime? | Candidate authority |
|------------|----------|---------|----------------|------------------|---------------------|
| **Membership `active`** | V2 IdentityPort / Gateway `a60aad5a` | Workspace access | Implemented | **V2 yes** | **Canonical for Workspace presence** (not operations) |
| **Gateway `domain` + `operation`** | `V2GatewayRequest` | Invocation surface | Implemented | **V2 yes** | **Not a permission catalog** — the thing to authorize |
| **`Capability`** | `lib/capabilities.ts` | Product/UI feature gating + operating model | Live Expo | **Production yes; V2 no** | **Layered** — Product/Experience after Workspace |
| **`EffectivePermissions`** | `lib/capabilities.ts` | Derived UI flags from Capability | Live Expo | Production yes | Derived, not a catalog |
| **Operating model** | `docs/RBAC_OPERATING_MODEL.md`, `useCapabilities()` | Asset / Aggregate / Hybrid ∩ capabilities | Live Expo | Production yes | **Layered** — Workspace/Product policy, not Actor Role |
| **`PlatformPermission`** | `lib/platform-identity/types/permissions.ts` | Delegated admin (invite, SSO, billing) | Live types + grants | Production (identity façade) | **Layered** — Workspace admin |
| **`PLATFORM_ROLE_GRANTS` / `PlatformTeamRole`** | `teamInviteRoles.util.ts` | Invite-time admin/planner/operator **plus** finance/sales/tripops/ground_ops/restricted | Live Expo | Production yes | **Layered / OPEN names** — Membership role **shape**; names **not frozen** for V2 |
| **Member domains / surfaces** | `organization_members.permissions`, `useMemberCapabilities.ts` | Per-member domain toggles | Live Expo | Production yes | Production JSON — **not V2 SoT** |
| **`@pulse/contracts` `Permission`** | `packages/contracts/src/identity/permissions.ts` | Hono `authorize(permission)` | Frozen **contract** for Hono | **Hono Identity yes; V2 Gateway no** | **Hono-scoped**; **not** V2 Gateway canonical without Owner |
| **`PlatformRole`** | `packages/contracts` jwt-claims `admin\|planner\|operator` | JWT role | Frozen JWT v1 | Hono JWT | Conflicts with “permissions not in JWT”; **not** V2 Membership freeze |
| **`06-permissions.md`** | `docs/architecture/platform/06-permissions.md` | Documents the split | **Seed — NOT frozen** | Docs only | **Not V2 authority** |
| **`UserRole` `user\|driver`** | `auth.service.ts` | Persona (driver vs org user) | Live Expo | Production yes | **Not** Workspace Role |
| **`ActorOperationalPermissions`** | `features/trips/capabilities/permissions.ts` | Trip event approve/settle from UserRole | Live trips | Production domain | **Business/domain helper** — not catalog |
| **`CommercialPermissions`** | `features/marketplace/domain/commercialPermissions.ts` | Bid/award vs lifecycle + visibility | Live marketplace | Production domain | **Business-state** — not catalog |
| **OMS `PlatformCapability`** | `oms/src/types/capabilities.ts` | Product licensing (catalog, ledger, …) | OMS UI | OMS | **Product entitlement / licensing** — not Actor RBAC |
| **`AdminPermission` / `AdminRole`** | `analytics/src/lib/permissions.ts` | Admin console | Analytics | Analytics | **Separate product** — not V2 domain RBAC |
| **DB `has_platform_permission` / indent RLS** | `supabase/migrations` | Production RLS stubs | Production DB | Production | **Not** V2 (deny-all V2 RLS) |

Do not collapse these names.

---

## 3. Evidence for each (primary three + V2)

### `Capability` (`lib/capabilities.ts`)

1. Expo/unified-base UI RBAC.  
2. Gate screens from profile + operating model.  
3. **Product/Experience**, not platform admin.  
4. Implementation type + architecture concept (operating model).  
5. Production runtime **yes**; `@pulse/v2` **no**.  
6. Not `@pulse/contracts`.  
7. Current production, not historical.  
8. Overlaps **intent** with contracts `commerce:*` / `ops:*` but different strings and derivation (client/profile — known weakness).  
9. Can remain **Product gating** without breaking ADR-005 (Law #6: not inside Auth).  
10. Enterprise: needs **server** derivation (Systems Architecture Review) — not Gateway-as-catalog.

**Decision: B — Layered** (Product/feature gating after trusted Workspace).

### `PlatformPermission`

1. Platform-identity delegated admin.  
2. Invite/remove/settings/SSO/billing **independent of relationshipType**.  
3. **Platform / Workspace admin**.  
4. Type + grants.  
5. Production identity façade.  
6. Not the contracts `Permission` union.  
7. Current.  
8. Overlaps `users:invite` / `USERS_INVITE` in contracts — **different identifiers**.  
9. Fits Layer 1 Shared Services / admin, not domain trips.  
10. Yes as a **small** admin set.

**Decision: B — Layered** (Workspace administration).

### `@pulse/contracts` `Permission`

1. Hono Identity / platform JWT era.  
2. HTTP `authorize(required: Permission)` from JWT `role`.  
3. Mixed platform (`org:read`) and product-wide wildcards (`commerce:*`).  
4. Frozen **transport/contract** for Identity service.  
5. `packages/platform/identity` middleware **yes**; V2 Gateway **no**.  
6. **Is** the contracts package.  
7. Live for dormant Hono; Identity Gate: Hono dormant for V2.  
8. Wildcards vs Capability enums vs PlatformPermission dotted names. JWT `role` vs Membership Role.  
9. Promoting it as V2 canonical **would** pull JWT-as-permission-authority (contradicts frozen JWT-without-permissions and OPEN B empty≠allow).  
10. Coarse `*:` grants are **not** enterprise-fine; they **are** bounded.

**Decision: B — Layered for Hono Identity HTTP only. C — Historical / not for new V2 Gateway work** until Owner explicitly in-scopes it.

### `06-permissions.md`

1. Architecture seed.  
2. Record that two systems are unreconciled.  
3. Meta.  
4. Architecture concept.  
5. No runtime.  
6. Points at both.  
7. Seed.  
8. Does not list contracts as a third in the body; Slice 3/Identity Gate correctly count **three**.  
9. Cannot become canonical until frozen by Owner.  
10. Useful as the **split** statement only.

**Decision: C — not V2 authority.** Retain as historical seed. Do not rewrite to erase the split.

### Membership `active` + Gateway operation

V2 **implemented** Workspace bar and **operation names**. Operations are **not** a permission vocabulary (Identity Gate: Operation ≠ Permission).

**Decision: Membership status = Canonical Workspace access. Operations = invocation keys, not a fourth catalog.**

---

## 4. Canonical vocabulary (what *is* frozen)

Only these are **canonical for V2 today**:

| Term | Meaning in V2 |
|------|----------------|
| **Auth Subject** | Authentication (OPEN A) |
| **Actor** | Pulse principal — does not authorize |
| **Membership** | Actor↔Workspace bridge; **Role lives here** |
| **Workspace** | Data/operating scope |
| **Gateway operation** | `domain` + `operation` string to be checked later |
| **AuthorizationContext** | Trusted actor/membership/workspace/correlation — **not** a permission dump |
| **Business rule** | Domain entity + state — **not** a permission |

**A permission** (when mapping exists): a **named allow for a class of action**, granted via **Membership Role** (+ Workspace/Product policy), **evaluated server-side**, **scoped to the trusted Workspace**, **never** from payload.

**Who owns it:** Pulse authorization mapping (Owner freeze) — not Auth, not the client.  
**Who receives it:** Membership (via Role), not Actor globally.  
**Where evaluated:** Gateway for platform/admin/operation class; Domain for entity/state.  
**What is NOT a permission:** Auth; Actor existence; Workspace id; entity lifecycle; Product licensing flags; UI `EffectivePermissions`.

---

## 5. Layering model (DECIDED — not a fourth catalog)

Evidence-backed layers (Identity Gate D5 + OPEN B Option C):

```text
1. Identity          Auth Subject → Actor          (OPEN A)
2. Workspace access  Membership active             (Slice 4 — CANONICAL)
3. Product policy    Operating model + Product Registry / OMS-style entitlements
4. Admin delegation  PlatformPermission
5. Product/UI grants Capability (server-derived in future)
6. Hono HTTP grants  contracts Permission          (Hono only unless Owner in-scopes)
7. Invocation        Gateway operation             (not a catalog)
8. Entity + state    Domain rules                  (not a catalog)
```

```text
Role (on Membership)
  → maps to PlatformPermission and/or Capability  [MAPPING OPEN]
Gateway authorizeOperation(ctx, domain, operation)
  → uses that mapping  [NOT IMPLEMENTED]
Domain
  → entity workspace_id + business-state
```

---

## 6. Role relationship

| Role concept | Kind | V2 |
|--------------|------|-----|
| Membership Role (Slice 4) | Workspace role | **Canonical placement**; **names OPEN** |
| `PlatformRole` admin/planner/operator | Platform JWT / Hono | Hono; **do not freeze as only V2 roles** |
| `PlatformTeamRole` (+ finance, sales, tripops, …) | Production invite / functional | Production; planner/operator **retired from new invites** |
| `UserRole` user/driver | Persona | Not Workspace Role |
| `AdminRole` | Analytics | Out of V2 domain RBAC |
| Org member `owner/admin/member` | Production org UI | Production |

**Role remains Membership-scoped.** Names are **not frozen**.

---

## 7. Gateway authorization vocabulary

Coarse checks (when implemented):

- Membership `active` (already)
- Optional: Product activation (Registry)
- Optional: `PlatformPermission` for admin operations
- Optional: `Capability` (or mapped equivalent) for product operations
- Gateway `operation` as the **key**, not the grant list

Not: trip state, settlement thresholds, `commerce:*` copied onto context.

---

## 8. Domain authorization boundary

Domains consume trusted context. They do **not** interpret `Capability` / `Permission` enums unless passed a Gateway decision. They own **this entity in this Workspace** and **this transition**.

---

## 9. Business-state authorization boundary

**Must not become permissions:**

- Order already dispatched  
- Settlement already approved  
- Trip completed  
- Marketplace `canAward` from lifecycle + visibility (`CommercialPermissions`)  
- Driver vs dispatcher operational event rights **as domain rules** (today mixed with `UserRole`)

---

## 10. Product / Experience granularity

Layer 1 is **not** a permission per Feature.

Day-1: Workspace membership + (later) Product activation + small Gateway operation set.  
Experience/Module/Feature: UI via Capability **after** context — not hundreds of V2 permissions.

---

## 11. `packages/contracts` relationship

Reusable as **Hono Identity HTTP** contract. Incomplete vs production `PlatformTeamRole`. Incompatible with V2 as **sole** catalog (JWT role, wildcards, unused by Gateway). **Do not modify contracts in this gate.**

---

## 12. `PlatformPermission` relationship

Keep **distinct** below Membership, **above** domain rules. Overlaps contracts invite/manage **by meaning**, not by string. Do **not** rename.

---

## 13. `06-permissions.md` relationship

Keep as **seed**. Conflicts: omits contracts as a third runtime vocab; V2 already counted three. Do **not** promote to V2 SoT. Do **not** rewrite history.

---

## 14. Deprecated / historical for **new V2 authorization**

| Item | Notes |
|------|--------|
| Client-only `getCapabilitiesFromProfile()` as SoT | Production defect; not V2 |
| JWT `permissions` / treating JWT `role` as V2 Membership Role | Frozen: permissions out of JWT |
| Slice 3 Model A Actor = Auth subject | OPEN A Model B |
| `06-permissions.md` as freeze | Seed |
| contracts `Permission` as V2 Gateway catalog | Hono-only unless Owner says otherwise |
| Analytics `AdminPermission` | Other product |
| `organization_members.permissions` JSON as V2 schema | Production |

---

## 15. Explicit non-decisions

- Exact Role names for V2 Membership  
- Exact mapping table operation → Capability / PlatformPermission / contracts Permission  
- Whether to in-scope Hono `Permission` for V2  
- Server capability derivation design  
- RLS, JWT claims, Auth, tables, RBAC runtime, policy engine  

---

## 16. Security invariants

| Check | Result |
|-------|--------|
| 1 No fourth catalog | **Pass** |
| 2 Role on Membership | **Pass** |
| 3 Actor ≠ authorize | **Pass** |
| 4 Workspace from Membership | **Pass** |
| 5 Gateway ≠ domain business | **Pass** |
| 6 Business-state domain-owned | **Pass** |
| 7 Empty permissions ≠ allow-all | **Pass** — absent mapping: **no operation RBAC**; platform bar = membership only; **when** operation checks exist, unknown/empty → **DENY** |
| 8 No client role/permission/ids | **Pass** |
| 9 Extraction possible | **Pass** — pass context + server map |
| 10 No production runtime change | **Pass** |

Absent / unknown / invalid role or permission / stale grants: **DENY** once operation authorization is enabled. Until then, do **not** interpret missing `permissions` on context as allow-all (OPEN B).

---

## 17. Implementation prerequisites

1. Owner mapping / freeze decision (this gate’s remainder).  
2. Then Gateway `authorizeOperation` against **existing** strings only.  
3. Still not: Auth, Membership SQL, RLS, JWT, hosted V2, Slice 5.

---

## 18. Next gate

**Single next architectural decision:**

> Owner: **(1)** confirm **permanent three-way layering** (Capability | PlatformPermission | contracts Permission / Hono), and **(2)** choose the **mapping target(s)** for V2 Gateway operations — or explicitly keep V2 at **membership-active-only** until `06-permissions.md` is frozen.

Do not implement RBAC before that.

---

*No runtime, contracts, migrations, tests, Auth, RLS, or production files were modified.*
