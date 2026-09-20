# Pulse Platform Principles

Non-negotiable rules for every module. Treat these as architecture gates before merging.

> This document defines the **technical implementation architecture** for the Pulse Platform. Business architecture, terminology, and platform boundaries are defined in [docs/architecture/platform/](../../docs/architecture/platform/01-platform-principles.md). **If a conflict exists, the business architecture is authoritative.** See [ADR-005](../../docs/decisions.md) for how the two reconcile.
> **Authoritative definitions:** [PLATFORM_CANONICAL_MODEL.md](./PLATFORM_CANONICAL_MODEL.md) — entities, IDs, lifecycles, events, API ownership.  
> **Phase order:** [ROADMAP.md](./ROADMAP.md)

## Architecture v1.0 — Frozen (Technical Architecture layer)

The technical/infrastructure architecture described in this document is **stable**: Gateway, Identity Service, Command Store, Timeline, Observatory. Business vocabulary (Workspace, Product, Experience) is governed by `docs/architecture/platform/01-platform-principles.md`, not by this document — see the note above.

New work must deliver customer value, enable production deployment, improve reliability/security/observability, or validate with a real customer.

See [ROADMAP.md](./ROADMAP.md) for phase priorities. Do not add speculative modules or infrastructure layers without meeting a gate criterion.

---

## Platform databases

Pulse Platform is split into bounded-context databases — **never shared**:

| Database | Owns |
|----------|------|
| **Identity DB** | Organizations, business units, warehouses, users, invitations, roles (minimal) |
| **Reference Data DB** | Master lookups (vehicle types, UoM, currencies, priorities, stop types) |
| **Configuration DB** | Tenant settings, defaults, feature toggles, integration refs |
| **Platform DB** | Command Store, Platform Timeline (append-only) |
| **Commerce DB** | Products, inventory, customers, sales orders, execution plans |
| **Execution DB** | Indents, trips, drivers, vehicles, POD |
| **Finance DB** | Settlement, invoices, ledger |
| **Network DB** | Marketplace, carriers, bidding |

Shared entities (e.g. Organization) are referenced **by ID**, not duplicated across stores.

**UI never writes databases directly.** Persistence (Supabase, Postgres, etc.) sits behind services only:

```
UI → API → Service → Database
```

---

## Command flow

```
Pulse Commerce → Pulse Gateway → Command Store → Service API → Service DB → Domain Events → Platform Timeline
```

Commerce sends commands (e.g. `POST /execution-plans`). The Execution Service owns:

- validation
- business rules
- ID generation
- event publishing
- transactions
- permissions

**Commerce must never write directly into the Execution database** — not via Supabase, not via shared clients, not in "live mode."

All future writers (Mobile Driver App, Dispatch Console, AI Dispatcher, Marketplace, External APIs) go through Execution Service.

---

## Platform SDK

Introduce **`@pulse/sdk` v1 only after APIs survive a pilot customer** (Phase 6). Contracts are still evolving — building the SDK now means rewriting it every week.

**Sequence:**

```
Platform Foundation (Identity → Command Store → Timeline)
  → Commerce + Planning APIs → Pilot → Pact + freeze → @pulse/sdk v1
```

Until then, apps use OpenAPI-backed `fetch` wrappers. No full SDK investment.

### Target structure (post-freeze)

```
@pulse/sdk
├── core/ · identity/ · commerce/ · planning/ · execution/
├── events/ · gateway/ · auth/ · observability/
```

---

## Pulse Platform vs business domains

**Platform** (Gateway, Identity, Command Store, Configuration, Reference Data, Timeline, Observatory, …) is a dedicated bounded context. Business domains **consume** it — they do not reimplement platform infrastructure.

| Business domain | Consumes Platform for |
|-----------------|----------------------|
| Pulse Commerce | Identity, Reference Data, Configuration, Gateway, Command Store, Timeline |
| Pulse Planning | Same + publish commands via Gateway |
| Pulse Execution | Identity scope, Reference Data codes, events |
| Pulse Finance | Identity, Configuration, events |

Commerce is the **first Platform consumer** in Phase 1B.

**Postponed until customer proof flow (Login → Invoice):** Marketplace, Talent, Fleet, AI workspaces, Configuration, Reference Data, Notifications, Search, Feature Flags.

---

## The data graph

Long-term value is the **connected graph**, not individual modules:

```
Organization → Warehouses, Customers, Products, Orders
            → Execution Plans → Trips → Drivers, Vehicles
            → Invoices, Payments → AI Insights
```

Protect with consistent IDs, eventing on every transition, and strict ownership boundaries.

---

## Core principles

1. **No shared databases** between bounded contexts.

2. **Commands flow only through the Pulse Gateway.** Products never call sibling services directly.

3. **State changes are communicated via versioned domain events.** REST for commands; events for status.

4. **Every entity carries tenant, organization, lifecycle, and audit metadata.** `EntityMetadata` is mandatory on publish.

5. **Every user interaction is traceable through a correlation ID.** Support must answer "where is my order?" from one ID.

6. **Every module uses the shared Pulse UI design system.** No one-off styling in product silos.

7. **AI augments decisions but does not own business state.** Agents recommend; bounded contexts commit.

8. **Service routing goes through Pulse Registry.** No hardcoded downstream URLs in product code.

9. **All commands and events are observable.** Command Store + Platform Timeline + Observatory. Business services use `PlatformRuntime.executeCommand()` — not ad-hoc inserts.

10. **Timeline ≠ Event Store.** Append-only; never update or delete. Observatory reads Timeline — not memory.

11. **Frozen envelopes.** [COMMAND_ENVELOPE](./contracts/COMMAND_ENVELOPE.md), [EVENT_ENVELOPE](./contracts/EVENT_ENVELOPE.md), and [TIMELINE_ENTRY](./contracts/TIMELINE_ENTRY.md) — never remove fields; only add optional ones.

12. **Gateway is the only external entry.** Sprint 2+. No service directly callable.

13. **Identity owns tenant context** — `membershipId` on JWT for audit and permissions.

14. **Customers → Feedback → Iteration.** One customer through Login → Invoice before new platform modules.

---

## Commercial workflow (must work without manual SQL)

```
Organization → Warehouse → Products → Inventory → Customer
  → Sales Order → Execution Plan → Gateway → Execution → Trip → Settlement → Invoice
```

---

## Order sources

All sources produce the same canonical `SalesOrder`:

Manual Entry · Shopify · WooCommerce · API · CSV Upload · EDI · Marketplace

The planning engine stays independent of order origin.

---

## Products (customer mental model)

Renamed from "Workspaces" per ADR-005 (`docs/decisions.md`) — **Workspace** is the tenant operating boundary in the governing business architecture (`docs/architecture/platform/03-workspace.md`); what this table lists are **Products** inside a Workspace (`docs/architecture/platform/04-products.md`).

| Product | Capabilities |
|-----------|--------------|
| Pulse Commerce | Catalog, Inventory, Customers, Orders, Planning |
| Pulse Operations | Dispatch, Control Tower, Exceptions, Live trips |
| Pulse Execution | Fleet, Driver, POD, Trips |
| Pulse Finance | Settlement, Invoice, Ledger |
| Pulse Network | Marketplace, Exchange, Bidding |
| Pulse Intelligence | AI Agents, Optimization, Forecasting |
| Pulse Admin | Identity, Integrations, Observatory |

**Operations** is the flagship workspace (Phase 5). Finance follows only after Operations is stable in production.
