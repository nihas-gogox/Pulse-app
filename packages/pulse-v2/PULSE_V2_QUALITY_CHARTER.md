# Pulse V2 Quality Charter

**Status:** ESTABLISHED (architecture quality contract)  
**Date:** 2026-09-20  
**Applies to:** Pulse V2 only (`packages/pulse-v2` and V2-owned design)  
**Does not apply to:** Frozen Oct 1 production line (`9776bc04` and subsequent production-only work)

This document is a **quality contract**. It is not authorization to implement Slice 4, reopen Gates A–C, provision infrastructure, modify production Auth/RLS/migrations, or extract microservices.

**Day-1 V2 deployment remains a modular monolith** with the existing in-process Gateway as the application boundary.

---

## 1. Executive intent

Production Pulse (assessed 2026-09-20) is a strong late-beta operating platform: domain model and accounting *intent* are serious; **trust and isolation** are the primary weaknesses.

**V2 must not reproduce the current architecture with a cleaner folder structure.**

The quality objective:

> **Pulse V2 must make the common operator actions local, predictable, bounded, observable, and financially trustworthy.**

Specifically:

| ID | Objective |
|----|-----------|
| **A** | One action must not mean “invalidate the whole Workspace.” |
| **B** | One screen must not require unrelated domain queries. |
| **C** | Financial truth must come from authoritative server-side state. |
| **D** | Workspace / Auth / session boundaries must be explicit before domain rendering. |
| **E** | Product surfaces must have intentional boundaries rather than becoming one giant suite. |
| **F** | Every significant operation must have an identifiable operational owner and a measurable query/load boundary. |

Reliability principle:

> **A domain operation must have a bounded blast radius.**

Data-access principle:

> **No correctness-critical product behavior may depend on arbitrary client-side dataset limits.**

Financial principle:

> **Money shown to an operator must be backed by authoritative server-side financial state.**

Acceptance principle (“one click”):

> **A local user action must have a locally understandable consequence.**

Scale principle:

> **10× current data must not turn a correct feature into an incorrect feature.**

---

## 2. Production findings (V2 design inputs only)

These findings are **not** production work. They do **not** authorize changes to the frozen Oct 1 line.

| Area | Assessment (2026-09-20) |
|------|-------------------------|
| Domain / business model | Strong |
| Accounting intent | Strong |
| Production accounting correctness | Not yet sufficiently trusted |
| Operator UX | Too dense |
| Reliability / blast radius | Weak |
| Information architecture | Too broad |
| Access-control design | Good conceptually, inconsistent in execution |
| Engineering craft | Good; complexity concentrated in trip/finance/auth/realtime |
| Ship discipline | Strong |

Observed production patterns (inputs, not a punch list for `9776bc04`):

- Global cache invalidation after a local command (expense approve/reject → `get_trips_for_org`, Finance, indents, quotes, analytics).
- `.limit(500)` as a hidden business rule for Cash totals (fixed in production for that org’s headline, **shape still client-download**).
- Unbounded `.in(...)` on commerce/execution-plan enrichment.
- Wide `get_trips_for_org` JSON RPCs.
- Client-side financial aggregation (`useFinanceLedger`).
- Load spinner ending before all required work.
- Domain route rendering without organization/session context (Compliance / `OrganizationProvider`).
- Auth restore races; PublicAuthTree vs AuthenticatedDataPlane gaps.
- Shared Postgres blast radius (app + cron + advisor indistinguishable in ops).
- Giant `trips.service.ts`; dense Finance hook; Realtime channel proliferation.
- Product suite hidden inside one app; documentation drift (barrel imports vs ESLint).

---

## 3. V2 quality principles

### P-Q1 — Bounded blast radius

A domain command updates **owning-domain state first**. Cross-domain effects are **explicit** (command → domain/application service → event → approved projection/read model). Implicit Workspace-wide invalidation is forbidden.

### P-Q2 — Explicit dependencies

Invalidation, refetch, and projection are **named dependencies**, not “refresh everything the UI might show.”

### P-Q3 — Gateway is the Day-1 application boundary

All V2 domain work enters through the existing in-process Gateway (`createPulseV2Gateway` / `execute()`). Handlers do not reach across domains by querying foreign tables. **Do not create microservices to satisfy these rules.**

### P-Q4 — Commands vs events (existing catalog)

- **Command** = intent (existing command envelope).
- **Event** = fact that already happened (existing event envelope + `docs/architecture/10-platform-event-catalog.md`).
- Do **not** invent a second event bus.
- Do **not** add catalog events without a real publisher and an identified consumer (reserved-event rule).

### P-Q5 — Workspace owns business data (Layer 1 Law #1)

Domain schemas and repositories are **storage and access partitions of Workspace-owned data**, not Product-owned copies. Compatible with Slice 2 persistence isolation. Products still do not own records (Law #2). Cross-product coupling remains **Workspace entities + events**, never Product→Product calls (Law #3).

### P-Q6 — Identity authenticates only (Layer 1 Law #6)

Authorization is **Actor → verified Membership → Workspace → AuthorizationContext**. Caller `workspaceId` is never authority (ADR-014, Identity Gate Decision 3).

### P-Q7 — No fourth permission catalog

Roles, permissions, capabilities, policies, product entitlements, and Gateway operations remain distinct. Do not invent a V2 permission enum (Identity Gate Decision 5).

### P-Q8 — Observability is provenance, not a new telemetry product

Use existing `correlationId` / command-event envelopes. Distinguish user command vs domain query vs RPC vs cron vs advisor vs Realtime vs projection vs infrastructure. Do not create a competing telemetry system.

### P-Q9 — Over-architecture is a defect

Forbidden unless a later evidence-based ADR requires them: Kafka, Redis, Kubernetes, service mesh, microservices, new event bus, new identity system, new permission catalog.

---

## 4. Production finding → V2 requirement (invariants and acceptance)

| Production finding | V2 requirement | Invariant / measurable criterion |
| ------------------ | -------------- | -------------------------------- |
| Global cache invalidation | Domain-scoped invalidation / explicit dependencies | **INV-INV-1:** A command may invalidate only its owning domain’s read models plus **listed** explicit subscribers. Workspace-wide `invalidateQueries` prefixes are non-compliant. |
| Expense action refetches unrelated domains | Command affects owning domain; downstream effects explicit | **AC-EXP-1:** Expense approve/reject must not require Marketplace/Indent/Quote queries as a side effect of the command path. Trip financial projection only via approved event/projection. |
| `.limit(500)` as hidden business rule | No correctness-critical arbitrary client limits | **INV-LIM-1:** If removing the client limit would change a displayed **authoritative** number, the design is non-compliant. Limits may exist only for **pagination/display**, never for truth. |
| Unbounded `.in(...)` | Bounded/batched queries with explicit limits | **INV-IN-1:** Every `.in` / `IN (...)` has a documented max cardinality and batching. Unbounded ID lists are non-compliant. |
| Full transaction download for totals | Server-owned financial aggregates | **AC-FIN-1:** Cash/expense/ledger/settlement **totals** are read from a server aggregate or read model, not `sum()` over a downloaded row set in the Experience. |
| Wide `get_trips_for_org` RPCs | Narrow domain/application queries | **INV-RPC-1:** List/query RPCs declare owned fields, expected cardinality, and max payload. “Org JSON dump” RPCs are non-compliant for V2 application reads. |
| Client-side financial aggregation | Server-side authoritative projections/aggregates | **INV-FIN-2:** Correctness-critical money is not computed solely in Experience hooks. |
| Load spinner ends before all required work | Explicit operation readiness contract | **AC-RDY-1:** A surface’s “ready” predicate lists required queries/commands; UI may not claim ready until that set completes or fails. |
| Compliance without org/session context | Explicit boot/session/workspace gate | **INV-BOOT-1:** Domain UI does not render on route match alone. Required AuthorizationContext must exist. |
| Auth restore races | Explicit authentication lifecycle/state machine | **INV-AUTH-1:** Boot states are named and exclusive (restoring / unauthenticated / authenticated-actor / membership-verified / workspace-bound). Domain UI is not in the first three. |
| Shared Postgres blast radius | Domain-level query/load isolation | **INV-ISO-1:** V2 domain data is accessed only through owned schemas/repositories (Slice 2). Production DB is not the V2 runtime store. |
| “Was it app or Supabase?” | First-class operation/query provenance | **AC-OBS-1:** A significant operation carries `correlationId` and an operation class (see §10). |
| Giant Trip service | Domain/application boundary enforcement | **INV-APP-1:** Execution/Trip application services do not own Finance, Commerce, or Identity persistence. |
| Dense Finance hook | Finance application/read-model boundary | **INV-FIN-3:** Experience Finance UI consumes Finance application/read-model APIs via Gateway, not multi-domain table scans. |
| Realtime channel proliferation | Explicit channel ownership and lifecycle | **INV-RT-1:** Each Realtime channel has an owning domain, subscribe/unsubscribe owner, and invalidation scope ≤ that domain unless an explicit event is listed. |
| Product suite in one app | Product → Experience → Module → Feature | **INV-IA-1:** Every major surface maps to Layer 1 vocabulary and a named owner. Size of a screen does not create a Product. |
| Documentation drift | Architecture/code contract validation | **AC-DOC-1:** V2 public contracts (Gateway, envelopes, catalog, this charter) must not contradict enforcement tests (`check:v2-boundaries`, `test:v2`) without a documented exception. |

---

## 5. Domain blast-radius rules

**Rule 1.** A domain cannot invalidate arbitrary global application state.

**Rule 2.** A domain command should update its own state first.

**Rule 3.** Cross-domain consequences must be explicit (event + identified consumer, or Gateway-orchestrated command with a named correlation).

**Rule 4.** Read models may aggregate across domains only through **approved** mechanisms (catalog events, approved projections). Not by the UI joining foreign repositories.

**Rule 5.** A UI component must not compensate for missing domain architecture by querying multiple unrelated domains directly.

**Rule 6.** The Gateway remains the Day-1 application boundary.

### Required shape (example: Expense approve)

```text
Expense Approve
      ↓
Expense command (Gateway, correlationId)
      ↓
Expense / Execution owned state
      ↓
Trip financial projection or catalog event (explicit)
```

### Forbidden shape

```text
Expense Approve
      ↓
Trip list RPC
      ↓
Finance transactions download
      ↓
Marketplace / indents / quotes
      ↓
Analytics
      ↓
Realtime storm
      ↓
Entire Workspace cache invalidation
```

Cross-domain effects use the **existing** command/event envelopes (`oms/docs/contracts/COMMAND_ENVELOPE.md`, `EVENT_ENVELOPE.md`; platform catalog). Frozen command fields include `commandId`, `commandName`, `idempotencyKey`, `correlationId`, `tenantId`, `payload`. Frozen event fields include `eventId`, `eventName`, `occurredAt`, `tenantId`, `correlationId`, `payload`. V2 Gateway maps envelope `tenantId` to **Workspace** per Slice 3 design; `tenantId` must not become a second RLS key on domain tables (Identity Authorization Design — OPEN mapping keys remain owner-required).

---

## 6. Data / query rules

### Intentional query shape

```text
Command / Query
    ↓
Application boundary (Gateway operation)
    ↓
Repository
    ↓
Owned domain data (Workspace-owned, domain-partitioned)
    ↓
Bounded result
```

A V2 repository (when implemented) must be able to answer:

| Question | Required |
|----------|----------|
| Why does this query exist? | Command/query name + use case |
| What data does it own? | Domain schema/tables or read model |
| Expected cardinality? | Order-of-magnitude |
| Maximum acceptable payload? | Bytes or row cap |
| Paginated? | Yes/no + page size |
| Aggregate? | Yes/no; if yes, server-owned |
| Read model? | Name + owning domain |

### Forbidden V2 equivalents of production anti-patterns

- Correctness-critical `.limit(N)` that **defines** the number.
- Unbounded `.in(...)` / `IN` lists.
- Full-table downloads used to compute aggregates in the Experience.
- Broad organization-level JSON RPCs as the default list read.
- Client-side financial aggregation as the source of displayed truth.

### Query Budget (architecture contract — not all filled now)

For important commands/queries, **eventually** record:

- owning domain
- tables / read models touched
- expected query count
- maximum fan-out
- maximum payload / cardinality
- timeout expectation
- cache / read-model behavior
- downstream events
- observability identifier (`correlationId` + operation name)

**Do not implement all query budgets in this change.** The contract is: no V2 application operation is complete without a budget *when that operation is designed/implemented*.

---

## 7. Financial truth rules

- The production accounting **domain model** (double-entry, derived balances, existing Pulse accounting docs) is **not redesigned** by this charter.
- The requirement is **trust and scalability**: the Experience consumes **authoritative server results**.

V2 should support server-owned (when Finance application/read models exist):

- balances
- cash totals
- expense totals
- ledger totals
- settlement totals
- other correctness-critical financial aggregates

If a financial value is derived, the design must name:

| Item | Required |
|------|----------|
| Source transactions / entries | Owning domain records |
| Projection / aggregate owner | Finance application or named read model |
| Update mechanism | Command completion + explicit event/projection |
| Consistency model | e.g. same-command sync vs eventual projection (must be stated) |
| Reconciliation strategy | How drift is detected (not “re-download the ledger”) |

**AC-SCALE-FIN:** A design that is correct at ~30–500 transactions and **wrong or timed out** at 5,000+ transactions is non-compliant, even if the UI still renders.

---

## 8. Boot / Auth / Workspace rules

Consistent with ADR-013, ADR-014, Slice 3, and Identity Gate Decision 3:

```text
Application Boot
    ↓
Session restoration
    ↓
Authenticated Actor
    ↓
Verified Membership
    ↓
Workspace (one authorized context per V2 session — ADR-014)
    ↓
AuthorizationContext
    ↓
Product / Experience
    ↓
Domain UI
```

**INV-BOOT-1:** A domain screen must not render merely because a file route matched.

**INV-BOOT-2:** Domain UI requires AuthorizationContext (trusted `workspaceId` from membership, never client-minted tenancy).

**INV-BOOT-3:** Authentication alone does not grant Product or Workspace data access (ADR-014 P7; Law #6).

Do **not** implement this boot machine in this change. Slice 4 remains unauthorized. Production Auth remains a separate plane (ADR-013). V2-owned Auth is the isolation default (Identity Gate Decision 2); one-login/federation remains OPEN — OWNER REQUIRED.

---

## 9. Product surface rules

Canonical hierarchy is **Layer 1** (`docs/architecture/platform/01-platform-principles.md`):

```text
Platform
  Identity
    ↓
  Workspace
    ↓
  Product
    ↓
  Experience
    ↓
  Module
    ↓
  Feature
    ↓
  Entity
```

Do not solve density by adding more navigation chrome. Do not merge major surfaces into a “super app” architecture. Do not create a new Product because a screen is large.

Every major V2 surface must have an **explicit owner** (domain + Product/Experience). Investigate ownership — **do not merge** — for:

| Surface | Typical V2 domain partition (Day-1 modular monolith) |
|---------|------------------------------------------------------|
| Trips / Execution | `execution` |
| Finance | `finance` |
| Commerce / Marketplace | `commerce` |
| Network | `network` |
| Identity / membership | `identity` (fence; tables not authorized here) |
| Compliance | Must map to a Product/Module owner before implementation; not a license to query all domains |
| Documents / POD | Execution (or named document module); events already in catalog (`PODUploaded`) |
| Driver / Workforce | Must map; not an implicit Trip-service dump |
| Communications | Platform shared service (Law #7), not a domain schema dump |

Gateway Day-1 domains in code today: **commerce**, **execution**. Finance/network/identity exist as **ownership fences** (Slice 1–2). Expanding Gateway `V2DomainName` is an implementation decision **after** this charter, not this change.

---

## 10. Observability requirements

First operational question: **what caused this?** — not “did Supabase die?”

Operation classes (use with existing `correlationId`):

| Class | Examples |
|-------|----------|
| User command | Gateway `execute` command |
| Domain query | Gateway query / repository read |
| RPC / database query | Adapter SQL |
| Scheduled job | Cron / log-watcher class work |
| Advisor / maintenance | Platform linters, vacuums |
| Realtime | CDC / channel |
| Background projection | Read-model updater |
| External dependency | Maps, storage, SMS |
| Infrastructure | Pool, WAL, idle-session, Warp |

Reuse: command/event envelopes, `PlatformEventLog` / correlation, existing platform observability. **No competing telemetry product.**

**AC-OBS-1:** Significant V2 operations are traceable by `correlationId` across Gateway → domain → persistence.

Current phase (ADR-015): test/local logs are sufficient. Hosted ops/PITR is **not** required by this charter.

---

## 11. Scale validation scenarios

Architecture validation scenarios — **not SLA commitments**, not capacity targets:

- 5,000+ financial transactions (totals still correct without downloading all rows)
- Large trip histories (list/detail remain bounded)
- Large execution-plan sets (no unbounded `.in`)
- Large Workspace datasets (org-level JSON dumps forbidden as the default read)
- Large driver/vehicle populations (list pagination; no full-graph fetch for a chip)

**Pass:** correctness and bounded payloads hold at ~10× current production-shaped volumes in tests/local.  
**Fail:** a feature becomes incorrect or unbounded solely because data grew.

---

## 12. V2 acceptance principles

1. **Local action, local consequence** (expense example in §5).
2. **Ready means ready** (operation readiness contract).
3. **Money is server-backed.**
4. **No domain UI without AuthorizationContext.**
5. **Gateway-first; no UI multi-domain compensation.**
6. **Catalog events only with publisher + consumer.**
7. **Query Budget exists when the operation is designed.**
8. **10× data does not invert correctness.**
9. **Documentation matches enforcement tests.**
10. **This charter never authorizes production-line edits.**

---

## 13. Explicit production freeze boundary

> These requirements apply to V2. They do **not** authorize changes to the frozen Oct 1 production line.

Treated as **V2 design inputs**, not production work:

- Finance 500-row limitation (and any remaining client-download totals shape)
- Broad trip RPCs
- Commerce `.in(...)` fan-out
- Expense invalidation fan-out
- Auth restore races
- Compliance boot/provider issue
- Dense Finance aggregation
- `trips.service.ts` concentration
- Realtime proliferation
- Shared Postgres blast radius

---

## 14. Relationship to existing ADRs and slices

### Compatibility (verified)

| Source | Result |
|--------|--------|
| **ADR-005 / Layer 1** | Compatible. Hierarchy, Laws #1–#7, vocabulary unchanged. Domain schemas = Workspace data partitions, not Product-owned data. |
| **ADR-013** | Compatible. Production Auth plane untouched. V2 Auth remains isolated when provisioned; not implemented here. |
| **ADR-014** | Compatible. One identity; one authorized Workspace context; Actor → Membership → Workspace → AuthorizationContext. Boot rules reinforce P1–P10. |
| **Slice 1** | **ACCEPTED.** Gateway + domain table guards **strengthened** (blast radius, Rule 6). |
| **Slice 2** | **ACCEPTED.** Persistence isolation **strengthened** (query/load isolation, INV-ISO-1). |
| **Slice 3** | **DESIGN ACCEPTED.** Boot/session/workspace contract **reinforces** trusted context; does not implement Identity. |
| **Command/event envelope** | Canonical. No second bus. |
| **Event catalog** | Canonical (`10-platform-event-catalog.md`). Reserved-event rule retained. |
| **Identity Gate** | Compatible: no fourth permission catalog; Gateway-first; Hono dormant; caller `workspaceId` never authority. |
| **ADR-015 / Gate C** | **Not reopened.** Current phase remains **local V2-only**. See conflict note below. |

### Conflict note (not silently resolved)

The initiating quality-charter request’s closing table listed **Gate C = NOT STARTED**.

**Repository fact:** Gate C is **CLOSED — LOCAL V2-ONLY** (`docs/ADR-015-pulse-v2-data-plane-infrastructure.md`, `STATUS.md`, Identity Gate Decision 7).

**This charter does not reopen Gate C** and does not rewrite ADR-015. Quality requirements that describe *eventual* hosted isolation, PITR, remote provenance, or production-scale load are **future Infrastructure evaluation criteria**. If they cannot be proven under ADR-015’s local phase, that requires a **new Infrastructure decision** (ADR-015 already allows a later C2 without reopening ADR-013/014) — **owner: Infrastructure + Architecture**. Not this document. Not Slice 4. Not automatic provisioning.

ADR-013’s older line “local vs hosted V2 is Gate C / not decided here” is **superseded for the current phase by ADR-015**, not by this charter.

No other STOP-level conflict with ADR-005, ADR-013, ADR-014, Slices 1–3, envelopes, catalog, or Layer 1 vocabulary was found.

---

## 15. Deferred implementation decisions

Not authorized by this charter:

- Slice 4 (Identity implementation, trusted context wiring, RLS policies)
- Filling Query Budgets for every operation
- Boot state machine in Experiences
- Server aggregate tables / Finance read models
- Gateway domain expansion (finance/network/identity handlers)
- New catalog events
- Hosted V2 provisioning
- Federation / one-login mechanism
- Organization→Workspace mapping keys (OPEN — OWNER REQUIRED)
- Permission mapping freeze (`06-permissions.md`)
- Hono port/extract
- Production code, production migrations, production Auth, production RLS

---

## 16. Query Budget template (for later use)

```text
Operation:           (command or query name)
Owning domain:       commerce | execution | finance | network | identity
Gateway operation:   (string)
Tables / read models:
Expected query count:
Max fan-out:
Max cardinality / payload:
Timeout expectation:
Cache / read-model:
Downstream events:   (catalog names or “none”)
Observability id:    correlationId + operation class
Blast-radius proof:  (why this cannot invalidate other domains)
```
