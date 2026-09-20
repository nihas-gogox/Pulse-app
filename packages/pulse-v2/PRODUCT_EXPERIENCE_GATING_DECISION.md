# Pulse V2 — Product / Experience Gating Decision

**Kind:** Owner decision / design only. No implementation.  
**Capability mapping:** no existing Capability applies (`e8c2b775`).  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Executive decision

### A — `NO PRODUCT/EXPERIENCE GATING REQUIRED FOR CURRENT V2 OPERATIONS`

The four Gateway operations remain:

```text
Membership.active → Trusted Workspace → Domain (entity / business-state)
```

**Capability stays UNMAPPED** for these operations. That is **sufficient for current V2 scope**, not a missing enum.

Product Registry **activation** and **Experience** availability remain **future Workspace entitlement** (Layer 1), not required to authorize today’s in-process slice.

---

## 2. Current Product architecture

ADR-005 / `01-platform-principles.md`:

```text
Workspace → Product → Experience → Module → Feature → Entity
```

**Product** = business capability on Workspace data, not an app and not a V2 `src/domains/*` folder.

**Experience** = UI within a Product (`05-experiences.md`). **Current state: not built.** Each production product has one implicit Experience. V2 has **no Experience**.

**V2 `commerce` / `execution`** = **bounded-context domains** behind the Gateway (Slice 1–2), not Layer 1 Products.

Law #3: Products do not call Products. V2 nested `createOrder` → `createTripFromOrder` is **Gateway-orchestrated domain** work, not Commerce Product writing Core tables.

---

## 3. Product Registry evidence

`08-product-registry.md` (frozen **schema**):

| Product (example) | creates / owns |
|-------------------|----------------|
| **Commerce** | Order |
| **Core** | Indent, Trip |

`activation`: `"always" | "required"` — **conceptual**. Grounded production: `suiteProducts.ts` (URL/path, **no DB activation** for Core/Commerce/Pilot) vs `workspace_products` (in-app **add-ons**). **Not wired into `@pulse/v2`.**

Registry is **data lineage / Product list**, not Actor RBAC and not Capability.

---

## 4. Commerce ownership

| Layer | Owner |
|-------|--------|
| **Product** | **Pulse Commerce** (`suite` id `commerce`; registry example owns **Order**) |
| **V2 domain** | `v2_commerce` / `sales_orders` |
| **Entity** | Workspace-owned Order (Law #1) |

Commerce Product is a **sibling** of Core (`04-products.md`), not a Module of Core.

---

## 5. Execution ownership

| Layer | Owner |
|-------|--------|
| **Product** | **Pulse Core** (registry: Core **owns Trip**). There is **no** Layer 1 Product named “Execution.” |
| **V2 domain** | `v2_execution` / `trips` (transport execution bounded context) |
| **OMS “Pulse Operations/Execution”** | Technical/product branding in OMS docs; ADR-005 renamed those **Products**, not V2 folder names |

Do **not** treat `src/domains/execution` as a Product for gating.

---

## 6. Four-operation analysis

| Operation | Membership | Product gating needed **now**? | Existing Capability | Domain |
|-----------|------------|--------------------------------|---------------------|--------|
| commerce.createOrder | Required | **No** | None | Required |
| commerce.getOrder | Required | **No** | None | Required |
| execution.createTripFromOrder | Required | **No** | None | Required |
| execution.getTrip | Required | **No** | None | Required |

**Create vs read:** Registry and Capability have **no** Order/Trip read vs write distinction. Do **not** invent `orders.read` / `trips.write`.

**Independently entitled Products?** Target architecture **allows** Workspace with Commerce activated and Core not (or the reverse). **Current V2 does not:** `createOrder` **always** nested-creates a trip. That coupling is **slice behavior**, not a Product entitlement decision. It does **not** require gating today; it would **conflict** with independent Product enablement if gating were added without changing that nest.

**Customer/business use case for V2 Product gating now?** **None in repository.** V2 is local architecture validation (ADR-015), no V2 Experience, no `workspace_products` in the Gateway path.

Adding gating now would be **architecture without a V2 requirement**.

---

## 7. Product gating requirement

**Not required** for the current four operations.

**Future (when independently entitled Products exist on V2):** Workspace entitlement via Registry **activation** (not Role, not PlatformPermission, not a fourth catalog). Then, if a **Capability** exists for that Product’s Experience, evaluate it **after** Membership.active. That is Outcome B **later**, not now.

---

## 8. Capability relationship

`lib/capabilities.ts` stays the only Capability vocabulary. **Unused** for these four operations (`GATEWAY_CAPABILITY_MAPPING_DECISION.md`). Do not add Order/Trip Capabilities here.

---

## 9. Membership relationship

Membership.active remains the **only** platform Workspace gate for these operations. Role on Membership is **not** Product entitlement. Role names stay OPEN.

---

## 10. Domain authorization relationship

OPEN B Option C: entity in trusted Workspace + business-state (ids, not-found, idempotent trip). Unchanged. Product gating would not replace this.

---

## 11. Security invariants

- Actor existence ≠ authorize  
- Membership.active required  
- Caller cannot choose Workspace / Actor / Role / Capability / Product entitlement  
- Empty Capability **must not** mean allow-all (Capability is simply **not evaluated** on these ops — that is not an empty-list allow)  
- Domain remains entity/state authority  
- Nested Commerce→Execution: **same** AuthorizationContext  

---

## 12. Future Product gating model

Only when there is a real entitlement requirement:

```text
Membership.active
  → Workspace
  → Product available (Registry activation — Workspace entitlement, not Actor RBAC)
  → Capability available (existing vocabulary, Owner-extended only by separate decision)
  → Domain authorization
```

Compatible with:

```text
Workspace: Product A on, Product B on, Product C off
```

Must **not** create: fourth catalog, operation-permissions, role-as-product, client Product authority, Product authz service, event bus, microservices.

**Prerequisite to that future:** change or qualify the **mandatory** `createOrder` → `createTripFromOrder` nest so Commerce can exist without Core Execution — a **product/domain design** change, not this gate.

---

## 13. Explicit non-decisions

- Extending `Capability`  
- Wiring `workspace_products` / suite activation into V2  
- Experience switching  
- Independent Commerce vs Core enablement in V2  
- Auth, Membership SQL, RLS, Slice 5  

---

## 14. Next gate

Authorization vocabulary for **current operations** is complete: Membership.active + domain.

**Single next architecture gate:** **Membership provisioning** — how an Actor obtains an `active` Membership (invite/bootstrap/owner). OPEN A creates Actor on first login **without** Membership; without this, data-plane stays denied. That is **not** Product gating and **not** authorized here.

---

*No runtime, capabilities, Product Registry, or production files were modified.*
