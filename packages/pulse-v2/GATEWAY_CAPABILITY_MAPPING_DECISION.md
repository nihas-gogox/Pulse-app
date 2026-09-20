# Pulse V2 — Gateway Capability Mapping Decision

**Kind:** Owner decision / design only. No implementation.  
**Layering:** CONFIRMED (`AUTHORIZATION_LAYERING_DECISION.md`, `f6aae65a`).  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Current authorization architecture

```text
Membership.active → Trusted Workspace
        ├── Capability (Product/Experience availability) — after Workspace
        ├── PlatformPermission (Workspace admin/delegation)
        └── Domain (entity + business-state)
```

Vocabularies are **not hierarchical**. Gateway `domain + operation` is an **invocation key**, not a catalog. No fourth permission catalog. Role on Membership; names unfrozen. Actor existence does not authorize.

---

## 2. Existing Capability inventory (relevant to V2)

**Sole source:** `lib/capabilities.ts`. Do not invent values.

| Capability | Documented meaning | EffectivePermissions / helpers | Product/Experience availability? | V2 Gateway fit |
|------------|--------------------|--------------------------------|----------------------------------|----------------|
| `fleet_management` | Manage vehicles, drivers, maintenance | vehicles, drivers | Garage / fleet Experience | No V2 garage operations |
| `dispatch` | Create **indents**, trips, assign drivers/vehicles | indents + trips create/view/assign; clients; suppliers | Production Core/dispatch UI | Production trip/indent **dispatch**, not V2 `sales_orders` |
| `dispatch_for_own_fleet` | Dispatch using **own org fleet** only | trips; clients; indent view-only | Asset operating-model trips | No V2 fleet-assign operation |
| `marketplace_post` | Post demand to marketplace | marketplacePost | Network/marketplace | No V2 marketplace ops |
| `marketplace_bid` | Bid on listings | marketplaceBid | Network/marketplace | No V2 marketplace ops |
| `finance_view` / `finance_manage` | View / manage finance | finance flags | Finance Experience | No V2 finance ops |
| `team_manage` | Invite and manage team | teamManage | Overlaps **PlatformPermission** admin in spirit | Admin, not Commerce/Execution |

**Consumers:** Expo `useCapabilities()`, navigation, RBAC operating model. **Not** `@pulse/v2`. Derivation is largely **client/profile** (known production weakness) — **not** V2 authorization SoT.

Capabilities are **Workspace-context feature flags for production Experiences**, not “may this Actor invoke this Gateway operation?”

---

## 3–4. Four operation analyses

| Operation | Existing Capability | Evidence | Capability meaning | Suitable for V2? | Decision |
|-----------|---------------------|----------|--------------------|------------------|----------|
| `commerce.createOrder` | none | Inserts `v2_commerce.sales_orders`. Product Registry example: **Commerce** creates/owns **Order**. `dispatch` grants indent/trip/client flags, **not** sales orders. | `dispatch` ≠ Commerce Order | **No** | **B — UNMAPPED** |
| `commerce.getOrder` | none | Read scoped sales order. No `orders.read` / `commerce_view` Capability. Must not inherit create’s Capability (none exists). | — | **No** | **B — UNMAPPED** |
| `execution.createTripFromOrder` | none | Nested from `createOrder`; inserts `v2_execution.trips` (`status: created`). Registry: **Core** owns Trip. `dispatch` = create indents/trips **and assign vehicles**. This op does **not** assign fleet or create an indent. Mapping to `dispatch` would treat operation-RBAC as Capability. | `dispatch` too broad / wrong product surface | **No** | **B — UNMAPPED** |
| `execution.getTrip` | none | Read trip in trusted Workspace. `canAccessTrips` is production UI helper from `dispatch*`, not a V2 get grant. Independent of create. | — | **No** | **B — UNMAPPED** |

**Owner decision: Option 2.**

Keep all four at:

```text
Membership.active + domain authorization
```

until Product/Experience gating is **explicitly designed** for V2 Commerce/Execution.

Do **not** create `orders.create`, `commerce.*`, or reuse `dispatch` as a stand-in.

---

## 5. Capability mappings

**None.**

---

## 6. Explicit unmapped operations

All four current V2 operations: **Capability intentionally UNMAPPED** because Product/Experience gating vocabulary does not cover them.

---

## 7. PlatformPermission = N/A

Confirmed. None of the four are `members.*`, org settings/archive, SSO, billing, or `identity.policy.edit`.

---

## 8. Domain authorization boundary

OPEN B Option C **preserved**.

| Operation | Domain (already in handlers) |
|-----------|------------------------------|
| createOrder | `id` required; persist trusted `workspaceId`; nested trip |
| getOrder | Entity must exist in trusted Workspace |
| createTripFromOrder | `orderId` required; idempotent existing trip; trusted Workspace |
| getTrip | Entity must exist in trusted Workspace |

Capability (when it exists later) answers **Product availability**, not these rules.

---

## 9. Nested Commerce → Execution

`createOrder` → `createTripFromOrder` uses Gateway **`dispatch(inner, ctx)`** — same AuthorizationContext, **one** membership lookup on the public `execute()`.

No second identity/membership flow. **No extra Capability** on the nested hop: both operations are UNMAPPED; inventing a nested Capability would be a new taxonomy.

If Capability is later evaluated at the **public Gateway** boundary, nested work **inherits** that public decision via the same context — it must **not** re-resolve Actor/Membership. Nested-specific Capability remains **out of scope** until Product gating exists.

---

## 10. Product Registry relationship

`08-product-registry.md` (frozen schema): Commerce **owns Order**; Core **owns Trip**. That is **data lineage / entitlement of Products to entities**, not Actor RBAC and not Capability.

`activation` / `suiteProducts` / `workspace_products` are **not** used as a V2 permission catalog. Do not map Gateway operations to registry `id: commerce` as a Capability substitute (that would be a new vocabulary).

---

## 11. No-new-vocabulary invariant

No new Capability enum, Permission enum, Role, `domain.operation` permission, policy engine, table, or catalog. Checks 1–8 in the prompt: **pass** (this document only).

---

## 12. Owner decision

### Option 2 — No existing Capability applies

```text
commerce.createOrder          → Membership.active + domain
commerce.getOrder             → Membership.active + domain
execution.createTripFromOrder → Membership.active + domain (nested: same ctx)
execution.getTrip             → Membership.active + domain
```

**Option 1 rejected:** no existing Capability **semantically** governs these Product surfaces without overloading `dispatch` or inventing names.

---

## 13. Future prerequisite if Product gating remains unavailable

V2 stays on Membership.active + domain until a **separate** architecture decision defines V2 Product/Experience gating **using existing Capability values or an Owner-approved extension of `lib/capabilities.ts`** (that extension is **not** this document and is **not** authorized here).

Next: do **not** implement Capability checks on these four operations.

---

*No runtime, `lib/capabilities.ts`, contracts, or production files were modified.*
