# Debit Control — Technical Contract (for review)

Status: **DRAFT FOR REVIEW — not approved, not implementation-ready.** No code, SQL, migration, schema change or database write was made. The only DB access was read-only catalog queries on preprod `xbisiveavvbifbzyfhgy`.

Inputs: [Debit Control - Sathish.docx](./Debit%20Control%20-%20Sathish.docx) (the original doc) · business-owner answers received 2026-09-30 (§0) · V1 audit in [PLAN.md](./PLAN.md) · [V1_FINDINGS.md](./V1_FINDINGS.md)

Labels used throughout: **CBR** = CONFIRMED BUSINESS RULE · **TD** = TECHNICAL DECISION (team can decide, must be reviewed) · **EXT** = EXTERNAL DEPENDENCY (another owner) · **BDR** = BUSINESS DECISION STILL REQUIRED

---

## 0. Business answers received (2026-09-30) — recorded verbatim in substance

| # | Answer (CBR) |
|---|---|
| D1 | Inward is **separate** from Trip Ops hard-copy receipt. Newly completed trips enter POD Pending. Inward records POD Count, Person Name, Client Name, LR Number, Courier Name (when applicable), Docket/AWB (when applicable). Direct/manual receipt by an org member is allowed; for it, courier details are not mandatory |
| D3 | POD Pending → Inward → Validate → Approve → Balance Payment Request → Ready for Invoicing → Approve Invoice → Invoicing / Bill Generation → Client Portal or manual submission. Client invoicing cannot happen without Debit Control approval |
| D4 | Balance Hold blocks **vendor balance payment only**, not client invoicing. Reasons include unresolved damage cost or incomplete multi-POD cases. Debit Control resolves and releases the hold. After release: Vendor Balance Payment Request → Finance. Decline-hold and Approve-Invoice-hold must stay distinguishable |
| D5 | Loading, unloading and detention from the POD participate in Client/Vendor Value. Treatment depends on cost type and agreement — not hard-coded "add" or "replace". Delay, damage and shortage are case/agreement dependent and attributable to vendor, client, driver or another party. Debit Control does **not** process debit notes, vendor deductions or client credit notes |
| D6 | Indent Type and Client Operations HUB are out of Debit Control scope. No new logic for them |
| D7 | Trips enter POD Pending when Trip Ops marks them Completed. No historical backfill unless specified later. Soft-copy and hard-copy POD stay separate concepts |
| D8 | Own fleet is out of scope for now. Keep the design extensible; build no vendor-side behaviour for own-fleet trips |
| D9 | Mark Inward: Debit Control + Admin. Validate / Approve / Approve Invoice / Decline / Release Hold: Debit Control. Reopen: Debit Control + Finance. The same user may Inward and later Approve (no separation of duties) |
| D10 | Approved and Approved-Invoice trips can be reopened, as an explicit authorized action (Debit Control + Finance). Finance determines the treatment of amounts, status and history. Original audit history is never overwritten |

### Answers that conflict with the original doc (need confirmation, not silently resolved)

- **K1 — Approve Invoice has two meanings.**
  - The original doc (§10–12) makes it a popup decision *alternative* to Approve: invoice approved, vendor balance **held**.
  - The D3 answer makes it a *later step* after Ready for Invoicing.
  - D4 ("Approve-Invoice hold") supports the doc's meaning. → **BDR-1**
- **K2 — Totals formula.** The doc fixes `Total = Cost + Loading + Halting + Unloading + Extra Point + Other + Special Approval`. D5 says the treatment depends on the agreement and must not be hard-coded. → **BDR-5**
- **K3 — Inward fields.** The doc requires POD Received Date, Courier and Docket (all mandatory). D1 lists POD Count, Person Name, Client Name, LR Number, and courier/docket only "when applicable". It does not mention a received date. → **BDR-7**
- **K4 — Doc field names not covered by D5:** Halting (= Detention?), Extra Point, Other Value, Special Approval, and "Client Cost" / "Vendor Cost" (= the existing base value, or re-entered?). → **BDR-6**

---

## 1. State machine

### Why two status fields, not one

Per D4, a Balance Hold blocks **only** the vendor balance payment, while client invoicing proceeds. So after Approve Invoice a trip must be *invoice-approved* **and** *vendor-balance held* at the same time. One linear status cannot express that. The minimum is:

- **`stage`** — the POD / client-invoicing track: `POD_PENDING → POD_RECEIVED → READY_FOR_INVOICING → INVOICE_APPROVED`
- **`vendor_balance`** — the vendor-payment track: `NONE → HELD(kind) | PAYMENT_REQUESTED`, where `kind ∈ {DECLINE, APPROVE_INVOICE}` (D4: must stay distinguishable)

**Not stored (derived, to avoid a second source of truth):**
- `INVOICED`: derived from `invoices.trip_ids` (Invoicing module owns it)
- `VENDOR_PAID`: derived from the existing `transactions` row with `ledger_category='compliance_balance'` (Finance owns it)
- Client Portal / manual submission: after bill generation, in the Invoicing module, outside Debit Control (**TD**/**EXT**)

**No `VALIDATED` state:**
- The doc's popup has no save-only button, and Cancel saves nothing (doc §11.4).
- Validation data is therefore submitted atomically *with* a decision (Approve / Approve Invoice / Decline). (**CBR** from doc; see BDR-9 if a draft save is wanted)

### Transition table

| # | Current state | Action | Next state | Actor (D9) | Side effects | Can repeat? | Can reverse? |
|---|---|---|---|---|---|---|---|
| T0 | (trip not in scope) | Trip Ops marks trip **Completed** (after go-live, vendor trip) | `stage=POD_PENDING`, `vendor_balance=NONE` | system | Create Debit Control record; audit `entered_pod_pending` | No (one record per trip) | n/a. Trip un-complete: **BDR-10** |
| T1 | `POD_PENDING` | **Mark Inward** | `POD_RECEIVED` | Debit Control, Admin | Store inward record; audit `inward`. Does **not** touch `trips.pod_received_at` (D1: separate from Trip Ops) | Idempotent retry only. Partial / multi-inward: **BDR-8** | Via Reopen only (**BDR-3**) |
| T2 | `POD_RECEIVED`, vendor `NONE` or `HELD(DECLINE)` | **Approve** (with validation payload) | `READY_FOR_INVOICING`; vendor → `PAYMENT_REQUESTED` (**BDR-2**: automatic, or a separate step) | Debit Control | New validation revision (frozen); audit `approved` | No (once per cycle) | Yes — Reopen (T8) |
| T3 | `POD_RECEIVED`, vendor `NONE` or `HELD(DECLINE)` | **Approve Invoice** (popup decision, doc meaning) | `INVOICE_APPROVED`; vendor → `HELD(APPROVE_INVOICE)` | Debit Control | New validation revision (frozen); audit `invoice_approved` + `hold_placed` | No | Yes — Reopen (T8) |
| T3b | `READY_FOR_INVOICING` | **Approve Invoice** (D3 meaning) | `INVOICE_APPROVED`; vendor unchanged | Debit Control | audit `invoice_approved` | No | Yes — Reopen |
| T4 | `POD_RECEIVED`, vendor `NONE` or `HELD(DECLINE)` | **Decline** (with payload + reason) | `POD_RECEIVED` (unchanged); vendor → `HELD(DECLINE)` | Debit Control | New validation revision; audit `declined` + `hold_placed` | **Yes** (re-review, doc §11.3); each is a new revision | Cleared by T2/T3 or T5 (**BDR-4**) |
| T5 | vendor `HELD(kind)` | **Release Hold** (with resolution note) | vendor → `PAYMENT_REQUESTED`; stage unchanged | Debit Control | audit `hold_released`; Finance sees the request | No | Via Reopen (**BDR-3**) |
| T6 | `INVOICE_APPROVED` | Invoice issued (Invoicing module) | derived `INVOICED` | Invoicing user | none in Debit Control (read from `invoices`) | n/a | Invoice cancellation is Invoicing-owned (**EXT-2**) |
| T7 | vendor `PAYMENT_REQUESTED` | Balance payment posted (Finance, existing path) | derived `VENDOR_PAID` | Finance | existing `compliance_balance` ledger row | n/a (existing unique index) | Finance-owned |
| T8 | `READY_FOR_INVOICING` or `INVOICE_APPROVED` | **Reopen / Reverse** (reason required) | Target: **BDR-3** | Debit Control, Finance | Current revision marked superseded (never deleted); audit `reopened`. Blocked if already `INVOICED` or `VENDOR_PAID` until **BDR-3** says otherwise (**TD**, safety guard) | Yes (each is a new cycle) | n/a |
| — | any | **Cancel** (close popup) | unchanged | anyone | **no write** | — | — |

**Blocked transitions (server rejects):** any action not in the table, e.g. Approve from `POD_PENDING`, Inward twice, Release on `NONE`, Approve Invoice from `INVOICE_APPROVED`.

**Gates in other modules** (the enforcement points are **EXT**):
- **Client invoice** allowed only when `stage=INVOICE_APPROVED` (D3: invoicing only after Approve Invoice).
- **Vendor balance payment**:
  - blocked while `vendor_balance=HELD` (D4, **CBR**)
  - whether it additionally *requires* `PAYMENT_REQUESTED` is **BDR-2**

---

## 2. Data contract

"Owner" = which module is the source of truth. "Audit" = what must be kept historically.

### 2.1 Debit Control trip record (one per in-scope trip)

| Field | Source | Owner | Required? | Mutable? | Historical/audit requirement |
|---|---|---|---|---|---|
| trip_id | `trips.id` | Trip Ops | Y | N | — |
| org_id | `trips.organization_id` | Trip Ops | Y | N | — |
| stage | state machine | Debit Control | Y | Only via RPC transitions | Every change = event |
| vendor_balance | state machine | Debit Control | Y | Only via RPC | Every change = event |
| hold_kind | T3/T4 | Debit Control | when HELD | Only via RPC | event |
| hold_reason | user | Debit Control | when HELD (**TD**: required) | Only via RPC | event |
| current_revision_id | latest validation revision | Debit Control | after first decision | Only via RPC | old revisions kept |
| entered_pending_at | T0 | system | Y | N | event |
| version | row counter | system | Y | Increments per transition | used for stale-popup detection |

### 2.2 Inward (D1)

| Field | Source | Owner | Required? | Mutable? | Audit |
|---|---|---|---|---|---|
| method | user: courier / direct | Debit Control | Y | N after save | event |
| pod_count | user | Debit Control | Y (**TD**: ≥1). Expected count: **BDR-8** | N | event |
| person_name | user | Debit Control | Y. Meaning (who handed over vs who received): **BDR-7** | N | event |
| client_name | prefilled from trip | Trip Ops | Y (display/confirm). Editable? **BDR-7** | N | event |
| lr_numbers | trip LR list (`trip_documents` LR index) | Trip Ops | Y. Per-LR inward: **BDR-8** | N | event |
| courier_name | user / `courier_partners` | Debit Control | Y if method=courier (D1: not mandatory for direct) | N | event |
| docket_awb | user | Debit Control | Y if method=courier | N | event |
| received_on (date) | user? | Debit Control | **BDR-7** (doc required it; D1 omits it) | N | event |
| received_by_user_id | `auth.uid()` | system | Y | N | event |
| recorded_at | server time | system | Y | N | event |

### 2.3 Soft vs hard POD (D7)

| Concept | Source | Owner | Note |
|---|---|---|---|
| Soft POD | `trip_documents` `document_type='pod'` | Trip Ops | Read-only in Debit Control (viewer) |
| Trip Ops hard-copy receipt | `trips.pod_received_at` + `pod_hard_copy_*` | Trip Ops / Compliance | **Not** written or read as the inward signal by Debit Control (D1) |
| Debit Control inward | §2.2 | Debit Control | Separate record |

### 2.4 Validation revision (charges + exceptions), append-only

| Field | Source | Owner | Required? | Mutable? | Audit |
|---|---|---|---|---|---|
| revision_no | system | Debit Control | Y | N | whole row immutable once written |
| base_client_value (snapshot) | `trips.client_price` at the time | Trip Ops / Finance | Y | N (snapshot) | kept per revision |
| base_vendor_value (snapshot) | `trips.supplier_rate` at the time | Trip Ops / Finance | Y (vendor trips) | N | kept |
| line items: cost_type, amount, side (client/vendor), treatment | user | Debit Control | per BDR-5/6 | N after save | kept |
| exception items: type (delay/damage/shortage), amount, attributed_to (vendor/client/driver/other), note | user | Debit Control | per case (**BDR-6**) | N after save | kept |
| final_client_value | computed per §3 | Debit Control | Y at Approve/Approve Invoice | N | kept |
| final_vendor_value | computed per §3 | Debit Control | Y at Approve/Approve Invoice | N | kept |
| rule_basis | agreement/cost-type rule used (**EXT-4**) | Debit Control | Y once rules exist | N | kept (explains the numbers) |
| remarks | user | Debit Control | N (Decline: reason required, **TD**) | N | kept |
| decision | approve / approve_invoice / decline | Debit Control | Y | N | kept |
| decided_by / decided_at | `auth.uid()` / server time | system | Y | N | kept ("Validated Date") |
| superseded_by_reopen_id | T8 | system | N | Set once | kept |

### 2.5 Hold, release, reopen

| Field | Source | Required? | Mutable? | Audit |
|---|---|---|---|---|
| hold_kind, hold_reason, placed_by/at | T3/T4 | Y | N (a new hold is a new event) | event |
| release_note, released_by/at | T5 | Y (**TD**) | N | event |
| reopen_reason, reopened_by/at, actor_role (debit_control/finance), target_stage | T8 | Y | N | event; prior revision kept, marked superseded |

### 2.6 Audit event (all actions) — see §5

---

## 3. Amount contract

| Component | Today in V1 | In Debit Control | Defined? |
|---|---|---|---|
| Base client value | `trips.client_price` (feeds AR/Revenue aggregations and the invoice subtotal) | Snapshot per revision; **never overwritten** by Debit Control (avoids repeating V1-3) | **CBR** (snapshot) / **TD** (no overwrite) |
| Base vendor value | `trips.supplier_rate` (feeds AP aggregations) | Snapshot per revision; never overwritten | same |
| POD loading cost | not captured (only driver-side `trip_other_expenses` 'loading', a different concept — not reused) | Line item, client side and/or vendor side | Participates (D5, **CBR**); **how**: **BDR-5** |
| POD unloading cost | same | Line item | same |
| Detention (= doc "Halting"? **BDR-6**) | not captured | Line item | same |
| Delay | not captured | Exception item + attributed party | Participation in final values: **BDR-6** |
| Damage | V1 "damage" deduction subtracted from `client_price` (contradicts D5) | Exception item + attributed party | **BDR-6** |
| Shortage / product missing | V1 "shortage" deduction (same) | Exception item + attributed party | **BDR-6** |
| Extra Point / Other / Special Approval (doc) | not captured | ? | **BDR-6** (not in D5 answer) |
| Final Client Value | — | Becomes the client billing amount (D5a, **CBR**) | Formula: **BDR-5**. How it reaches the invoice and AR: **EXT-2 / EXT-3** |
| Final Vendor Value | — | Becomes the vendor payable (D5b, **CBR**) | Formula: **BDR-5**. How it reaches AP / balance payment: **EXT-1 / EXT-3** |

**Exactly what is undefined for D5-C (not invented here):**
1. For each cost type (loading, unloading, detention, and any others) × agreement type: does the amount add to client value, vendor value, both, neither (pass-through), or replace a base component?
2. Where the "agreement" lives. Candidates are client lane pricing models (`per_trip`, `per_ton`, `spot`…) for the client side; there is **no** known vendor-agreement source. (**EXT-4**)
3. For delay, damage and shortage: whether an attributed amount changes either final value, or is recorded only for downstream teams (D5 says Debit Control doesn't process debit/credit notes).
4. Until rules exist: does the Debit Control user choose the treatment per line (manual, recorded in `rule_basis`), or is Debit Control blocked until a rule table is configured? (**BDR-5**)
5. Rounding and currency: **TD** (INR, 2 decimals, non-negative amounts; computed on the server and shown as a preview in the client).

**Ledger interaction:**
- Debit Control writes **no** `transactions` rows (D5: it doesn't process notes or deductions).
- Whether AR/AP aggregations and the invoice subtotal switch from `client_price`/`supplier_rate` to the final values, and when, is Finance/Invoicing-owned. (**EXT-2**, **EXT-3**)

---

## 4. Permission matrix (server-enforced)

Every mutation goes through a SECURITY DEFINER RPC that checks **all** of:
1. The caller is authenticated.
2. The caller is an **active member of `trips.organization_id`**. (**TD**: only the owning org runs Debit Control; supplier- or client-linked orgs cannot act.)
3. The caller holds the action's surface (below).
4. The trip is a vendor trip (`supplier_id` not null — D8 excludes own-fleet), and it is not deleted.
5. The trip is in the required state (§1), checked under a row lock.

UI gates are only for convenience.

| Action | Allowed (D9) | Proposed surface (**TD**) | Required state | Notes |
|---|---|---|---|---|
| View Debit Control lists | Debit Control, Admin, Finance (**TD**: read access unspecified → **BDR-11**) | `debit_control.view` | any | New membership-checked read RPC. **Not** `get_trips_for_pod_org` (Finding A) |
| Mark Inward | Debit Control + Admin | `debit_control.inward` | `POD_PENDING` | |
| Validate (open popup / preview) | Debit Control | `debit_control.validate` | `POD_RECEIVED` | read-only until a decision |
| Approve / Approve Invoice / Decline | Debit Control | `debit_control.validate` | per T2/T3/T3b/T4 | same user as the inward is allowed (D9) |
| Release Hold | Debit Control | `debit_control.release_hold` | vendor `HELD` | |
| Reopen / Reverse | Debit Control + Finance | `debit_control.reopen` | per T8 | |

**Conflict to resolve (BDR-11):**
- `has_member_surface` returns **true for every surface** for org `owner` and `admin` (`20260915162440_trip_compliance_verification_columns.sql`).
- So using it as-is lets owners and admins Validate, Approve, Release and Reopen. D9 grants Admin only Mark Inward.
- If D9 is meant strictly, we need a helper that does not auto-grant owner/admin for these surfaces (**TD**). If admins *should* be able to act, D9 needs amending.

**Role packaging (TD + EXT-5):**
- Add a `debit_control` platform team role preset, like the existing `compliance` preset in `features/organization/utils/teamInviteRoles.util.ts`.
- Define which existing `finance` members get `debit_control.reopen`.
- Register the surfaces in `lib/memberSurfaces.ts`.
- Update `docs/RBAC_OPERATING_MODEL.md` + changelog, and keep `ModelAccessGate` in sync with `lib/navigationPolicy/registry/org.ts`.
- Operating model: Aggregate/Hybrid orgs only (vendor trips); not Asset-only (D8).

---

## 5. Audit contract

- **Must emit an immutable event** (append-only; no UPDATE/DELETE by anyone except a documented break-glass, **TD**):
  - `entered_pod_pending`
  - `inward`
  - `approved`
  - `invoice_approved`
  - `declined`
  - `hold_placed`
  - `hold_released`
  - `reopened`
  - rejected-transition attempts: **TD**, optional
- **Every event carries:** `event_id`, `trip_id`, `org_id`, `actor_id`, actor role/surface used, `event_type`, `from_state` → `to_state` (both fields), `revision_id` (if any), `payload` (the submitted values), `idempotency_key`, `created_at` (server).
- **"Validate"** is audited through the decision event that carries the validation revision, since there is no separate save (§1).
- **Reopen** never edits or deletes earlier events or revisions. It adds a `reopened` event and marks the prior revision `superseded_by`. The full history Inward → Validation → decision → reopen → new decision stays readable (doc §18 last bullet; D10).
- **Audit writes run in the same transaction as the state change.** If the audit write fails, the action fails, which fixes the V1 pattern where a failed audit is treated as success (Finding B).
- **Storage choice** — reuse `trip_workflow_events` (already has `idempotency_key`) vs a dedicated table — is **EXT-6**. It is tied to the canonical-audit decision owned by the Finding B owner. `log_activity` is **not** used.

---

## 6. Existing V1 dependencies

| Dependency | Can Debit Control safely depend on current V1 behaviour? | Required before |
|---|---|---|
| **Finding A** — `get_trips_for_pod_org` has no membership check | **No.** Debit Control must not read through it. Its own read RPC must check membership (§4), so the feature does not *inherit* the defect. The shared POD Reconciliation surface stays exposed until the owner acts | Pre-prod release gate: owner resolution or explicit acceptance |
| **Finding B** — `log_activity` / `activity_logs` missing | **No.** Debit Control must not call it. Its audit mechanism must match the canonical one the Finding B owner chooses | **Before the DB migration is written** (audit storage is part of the schema) |
| **EXT-1** — vendor balance payment guard: restrictive RLS policies `compliance_balance_requires_pod_received(_on_update)` on `transactions` (`20260921125437_…`), gated only on Trip Ops `pod_received_at` | **No.** It knows nothing about a Balance Hold. It needs an additional block while `vendor_balance=HELD` (and possibly a requirement of `PAYMENT_REQUESTED`, BDR-2). Owner: Compliance/Finance | Implementation (D4 is unenforceable without it) |
| **EXT-2** — client invoicing: `issue_customer_invoice` takes a client-computed subtotal from `client_price` | **No.** It must reject trips not in `INVOICE_APPROVED`, and use the Final Client Value as its amount source (D5a). Does `issue_manual_invoice` / `issue_manual_plan_invoice` bill trips? Unknown → check. Owner: Invoicing | Implementation |
| **EXT-3** — AR/AP aggregations read `client_price` / `supplier_rate` | Unknown until Finance decides whether and when final values flow into the ledger | Release |
| **V1-4** — dead `approved` tab / missing `invoice_status_1` | Not used by Debit Control | — |
| Existing POD Reconciliation screen | Untouched. Coexist vs replace: **BDR-12** | Implementation |

---

## 7. Database design proposal (prose only — no SQL, no migration)

Proposed, pending the BDR/EXT items; names are placeholders.

- **Tables**
  - `debit_control_trips`: §2.1. One row per trip; unique on `trip_id`; FK to `trips`; `stage` and `vendor_balance` as check-constrained text; `hold_kind` required iff `vendor_balance='HELD'`; `version` integer.
  - `debit_control_inwards`: §2.2. FK to the trip record. One row per inward (multi-row only if BDR-8 allows); check constraint that courier + docket are present when method = courier.
  - `debit_control_revisions`: §2.4, append-only. Unique (`trip_id`, `revision_no`). Line items and exception items either as child tables (**TD**, preferred for reporting) or as validated JSON.
  - Audit: per EXT-6, either `trip_workflow_events` with `debit_control.*` event types, or a dedicated `debit_control_events` table. Unique (`trip_id`, `idempotency_key`).
- **Constraints:** amounts `numeric(14,2) ≥ 0`; enums via check constraints; immutability triggers on revisions and events (reject UPDATE/DELETE).
- **RPCs** (SECURITY DEFINER, `search_path=public`, grant to `authenticated` only):
  - `dc_mark_inward(trip_ids[], payload, idempotency_key)`
  - `dc_decide(trip_id, decision, payload, expected_version, idempotency_key)`
  - `dc_release_hold(trip_id, note, expected_version, idempotency_key)`
  - `dc_reopen(trip_id, reason, target, expected_version, idempotency_key)`
  - `dc_list(org_id, stage, filters)` (membership-checked read)
  - `dc_history(trip_id)`
- **Entry (T0):**
  - **TD** — either an AFTER UPDATE trigger on `trips` when status becomes `completed` (after the go-live timestamp, vendor trips only), or lazy creation on first read.
  - A trigger touches a shared hot table (there are already 20+ triggers on `trips`), so it needs a review.
  - No backfill (D7).
- **Indexes:** (`org_id`, `stage`), (`org_id`, `vendor_balance`), (`trip_id`) on inwards/revisions/events, (`trip_id`, `created_at`) on events.
- **RLS:** enabled on all new tables. SELECT only for active members of the trip's org with `debit_control.view`. **No** INSERT/UPDATE/DELETE policies (all writes through RPCs). No `anon` access.
- **Idempotency:**
  - Every mutating RPC requires a client-generated `idempotency_key`. A replay with the same key returns the original result and writes nothing.
  - `select … for update` on the trip record, plus `expected_version`, rejects stale popups and concurrent double-decisions.
  - Bulk inward is all-or-nothing in one transaction and returns per-trip precondition errors. (**TD**)
- **Audit storage:** per EXT-6; the audit write is in the same transaction.

---

## 8. Test plan

| Area | Tests |
|---|---|
| State transitions | Each row T0–T8 succeeds from its allowed state; every other (state, action) pair is rejected with a stable error code (table-driven) |
| Unauthorized actions | Per D9 matrix: member without the surface → reject. Admin → Inward only (per BDR-11 outcome). Finance → Reopen only. Driver/dispatcher → reject. Anon → no execute |
| Organization isolation | Non-member reads/writes another org's trip → reject. Supplier-linked / client-linked org → cannot act. `dc_list` never returns other orgs' rows |
| Duplicate / retry | Same idempotency key twice → one event, same result. Two concurrent Approves → one wins, the other gets a version conflict. Double-click in the UI sends one request |
| Approval (T2) | Revision frozen, stage/vendor state per BDR-2, event written |
| Invoice approval (T3/T3b) | Both entry points per BDR-1. Hold kind `APPROVE_INVOICE`. `issue_customer_invoice` accepts only `INVOICE_APPROVED` trips (EXT-2) |
| Balance Hold | While HELD, the vendor balance posting is rejected by the DB (EXT-1). Client invoicing is **not** blocked by the hold (D4) |
| Hold release | HELD → PAYMENT_REQUESTED. Release on NONE → reject. Decline-hold release per BDR-4 |
| Decline | Stays POD_RECEIVED. Repeatable, each a new revision. Reason required. Earlier revisions intact |
| Reversal | Allowed roles only. Prior revision superseded, not deleted. Blocked after INVOICED / VENDOR_PAID unless BDR-3 allows. Target stage per BDR-3 |
| Audit history | Every action writes exactly one event in the same transaction. A forced audit failure rolls the action back. UPDATE/DELETE on events and revisions → rejected. Full history readable after reopen |
| Amount calculation | Pure unit tests of the agreed rules (after BDR-5/6). Base values snapshotted. `client_price`/`supplier_rate` unchanged by Debit Control. Rounding. Blank vs 0 |
| Existing POD regression | POD Reconciliation list/summary/tabs unchanged. Log Incoming PODs and `record_trip_hard_copy_pod` unchanged (Debit Control does not write `pod_received_at`). Compliance advance/balance flows unchanged except the new hold block. Invoicing regression suite |
| Soft vs hard POD | Soft POD viewable in Debit Control. Trip Ops hard-copy receipt does **not** move a trip out of POD_PENDING |
| Own fleet (D8) | Trips without `supplier_id` never enter Debit Control |
| History (D7) | Trips completed before go-live never appear; no backfill |

Test method: SQL lifecycle scripts in a rolled-back transaction with synthetic users (same pattern as `docs/compliance/dinesh/preprod/`), Jest for utils/services/components, and Playwright for the end-to-end flow. No fixture encodes a BDR item until it is answered.

---

## 9. Classification of every open item

| ID | Item | Class |
|---|---|---|
| — | D1 separate inward; D3 sequence; D4 vendor-only hold, Debit Control releases, kinds distinguishable; D5a/b final values = billing/payable; D5 no debit/credit processing; D6 out of scope; D7 entry on Completed, no backfill, soft≠hard; D8 own fleet out; D9 matrix incl. same-user; D10 reopen allowed, history preserved | **CONFIRMED BUSINESS RULE** |
| BDR-1 | Approve Invoice: popup alternative (hold), later step after Ready for Invoicing, or both (K1) | **BUSINESS DECISION STILL REQUIRED** |
| BDR-2 | Is Balance Payment Request automatic on Approve, and must vendor balance payment *require* it (or only be not-held)? | **BUSINESS DECISION STILL REQUIRED** |
| BDR-3 | Reopen: target stage; allowed after invoice issued / balance paid? What happens to the hold and payment request? (D10 says Finance determines treatment — we need the rule) | **BUSINESS DECISION STILL REQUIRED** |
| BDR-4 | How is a Decline hold cleared: explicit Release, or by a later Approve / Approve Invoice? | **BUSINESS DECISION STILL REQUIRED** |
| BDR-5 | Cost-type × agreement treatment for loading/unloading/detention; manual per-line choice vs configured rules (K2) | **BUSINESS DECISION STILL REQUIRED** |
| BDR-6 | Delay/damage/shortage effect on final values; meaning of Halting, Extra Point, Other, Special Approval, Client/Vendor Cost (K4) | **BUSINESS DECISION STILL REQUIRED** |
| BDR-7 | Inward field meanings: Person Name (handed over vs received), Client Name editable?, received date needed? (K3) | **BUSINESS DECISION STILL REQUIRED** |
| BDR-8 | Multiple / partial inwards per trip (per LR, POD Count vs expected); does incomplete POD keep the trip in POD Pending? | **BUSINESS DECISION STILL REQUIRED** |
| BDR-9 | Is a "save draft" validation needed (the doc says Cancel saves nothing)? | **BUSINESS DECISION STILL REQUIRED** (low) |
| BDR-10 | Trip un-completed after entering POD Pending | **BUSINESS DECISION STILL REQUIRED** (low) |
| BDR-11 | Owner/admin auto-grant conflict with D9; who can *view* Debit Control lists | **BUSINESS DECISION STILL REQUIRED** |
| BDR-12 | Debit Control coexists with or replaces the POD Reconciliation screen | **BUSINESS DECISION STILL REQUIRED** |
| TD-1 | Two status fields (stage + vendor_balance); INVOICED / VENDOR_PAID derived | **TECHNICAL DECISION** |
| TD-2 | Only the owning org acts; vendor trips only; Aggregate/Hybrid | **TECHNICAL DECISION** |
| TD-3 | Surfaces + `debit_control` role preset; owner/admin handling per BDR-11 | **TECHNICAL DECISION** |
| TD-4 | Entry mechanism (trigger on `trips` vs lazy) | **TECHNICAL DECISION** |
| TD-5 | Append-only revisions; never overwrite `client_price`/`supplier_rate` | **TECHNICAL DECISION** |
| TD-6 | Idempotency key + row lock + expected_version; bulk inward all-or-nothing | **TECHNICAL DECISION** |
| TD-7 | Reopen blocked after INVOICED / VENDOR_PAID pending BDR-3 (temporary safety guard) | **TECHNICAL DECISION** |
| TD-8 | Child tables vs JSON for line items; amounts numeric(14,2) ≥ 0 | **TECHNICAL DECISION** |
| EXT-1 | Vendor balance payment guard must honour the hold (Compliance/Finance owner) | **EXTERNAL DEPENDENCY** |
| EXT-2 | `issue_customer_invoice` gate + amount source; manual/plan invoice paths (Invoicing owner) | **EXTERNAL DEPENDENCY** |
| EXT-3 | AR/AP use of final values; reopen treatment (Finance) | **EXTERNAL DEPENDENCY** |
| EXT-4 | Agreement / cost-type source; no vendor-agreement source known | **EXTERNAL DEPENDENCY** |
| EXT-5 | RBAC doc/registry updates; `ModelAccessGate` ↔ navigation policy | **EXTERNAL DEPENDENCY** |
| EXT-6 | Canonical audit store (tied to Finding B owner) | **EXTERNAL DEPENDENCY** |
| A | `get_trips_for_pod_org` authorization (DB/security owner) | **EXTERNAL DEPENDENCY** |
| B | `log_activity` missing (audit/platform owner) | **EXTERNAL DEPENDENCY** |
