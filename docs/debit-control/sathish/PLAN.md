# Debit Control — Sathish's POD Management & Validation Workflow

Source: [Debit Control - Sathish.docx](./Debit%20Control%20-%20Sathish.docx)
Branch: `debit-control-sathish` (baseline: V1 @ f6cb238a) · pushed to origin at be042f6c from outside this session; later commits local · Technical contract: [CONTRACT.md](./CONTRACT.md) (draft for review)

## Progress

| # | Change | Status |
|---|--------|--------|
| 0 | V1 audit + implementation contract | ✅ Done (2026-09-29) — see CONTRACT STATUS |
| 1 | POD Pending list (completed trips, Soft POD viewer, multi-select) | ⛔ Blocked on D1 |
| 2 | Proceed to Inward → Mark Inward (date, courier, docket; bulk) | ⛔ Blocked on D1, T1 |
| 3 | POD Received list (trip / client / vendor / other columns) | ⛔ Blocked on D6, T4, T5 |
| 4 | Validation popup (client + vendor charges, exceptions, totals, remarks) | ⛔ Blocked on D5 |
| 5 | Actions: Approve / Approve Invoice / Decline / Cancel + status | ⛔ Blocked on D3, D4, D5 |
| 6 | Audit history (Inward → Validation → Action per trip) | ⬜ Not started (no blocker once 2–5 are defined) |
| 7 | QA + CI gates | ⬜ Not started |

Legend: ⬜ Not started · 🟡 In progress / partial · ✅ Done · ⛔ Blocked

**Implementation status: FROZEN — NOT READY.** Until Sathish answers D1 and D3–D10, there is no migration, RPC, schema change, feature code, status-transition code, finance integration, or test fixture that encodes an unresolved rule. Nothing in this branch changes code, schema or data. All DB facts below come from read-only `information_schema` / `pg_catalog` queries against linked preprod `xbisiveavvbifbzyfhgy`.

Decision request to send: [SATHISH_DECISIONS.md](./SATHISH_DECISIONS.md) · V1 defects for other owners: [V1_FINDINGS.md](./V1_FINDINGS.md)

## OWNERSHIP

No individual assignments are documented; these are roles or workstreams, not people.

| Workstream | Owner | Status | Can start now? |
|---|---|---|---|
| Sathish business decisions (D1, D3–D10) | Sathish / feature owner | Answered 2026-09-30; follow-ups BDR-1..12 open ([CONTRACT.md §9](./CONTRACT.md#9-classification-of-every-open-item)) | No implementation |
| Debit Control implementation | Sathish feature branch (`debit-control-sathish`) | Blocked — documentation only | No |
| POD RPC security finding (A) | DB/security owner | Confirmed by team-lead read-only re-check (2026-09-29). Needs owner's independent verification | Yes, investigation only |
| Audit/logging finding (B) | Audit/platform owner | Confirmed by team-lead read-only re-check (2026-09-29). Needs owner's independent verification | Yes, investigation only |
| Integration/review | Team lead | Waiting for contract | No |

> **Dependency** — existing POD/audit infrastructure must satisfy the required authorization and audit guarantees before production release.

Findings A and B are **not** Debit Control requirements. They are existing V1 defects with separate owners. Debit Control depends only on their outcome, per the Dependency above.

## IMPLEMENTATION ENTRY GATE

Debit Control implementation can begin only when **all** of these are true:

- [ ] D1 answered — top level yes; BDR-7, BDR-8 open
- [ ] D3 answered — top level yes; BDR-1, BDR-2 open
- [ ] D4 answered — top level yes; BDR-4 open
- [ ] D5 answered — top level yes; BDR-5, BDR-6 open (+ EXT-4)
- [x] D6 answered — out of scope
- [ ] D7 answered — top level yes; BDR-10 open (low)
- [x] D8 answered — own fleet out of scope
- [ ] D9 answered — top level yes; BDR-11 open (owner/admin auto-grant)
- [ ] D10 answered — top level yes; BDR-3 open
- [ ] Resulting state machine reviewed — draft in CONTRACT.md §1
- [ ] Amount / ledger semantics reviewed — draft in CONTRACT.md §3 (blocked on BDR-5/6, EXT-2/3/4)
- [ ] Authorization model reviewed — draft in CONTRACT.md §4
- [ ] Audit strategy reviewed — draft in CONTRACT.md §5 (blocked on EXT-6 / Finding B owner)

(D2 stays on its safe default unless Sathish changes it.)

## PRE-PROD RELEASE GATE

Before deployment:

- [ ] Migrations reviewed
- [ ] RLS / authorization tests pass
- [ ] Action idempotency tested
- [ ] Audit events verified
- [ ] Finance integration verified
- [ ] Existing POD Reconciliation regression tests pass
- [ ] Existing Invoicing regression tests pass
- [ ] End-to-end Debit Control flow passes
- [ ] No unresolved business decisions
- [ ] Dependency above satisfied (Findings A / B resolved or explicitly accepted by their owners)

## BLOCKERS / EXTERNAL OWNERS

Kept separate from the feature checklist. None of these is fixed in this branch.

### A. Sathish — business decisions (blocks implementation)

| # | Decision | Status |
|---|---|---|
| D1 | Inward = Trip Ops hard-copy receipt? Docket = AWB? "In hand" allowed? | ⛔ Awaiting Sathish |
| D2 | Multi-trip Validate | ✅ Safe default (one popup per trip) — Sathish may override |
| D3 | Destination / status after Approve and Approve Invoice | ⛔ Awaiting Sathish |
| D4 | What Balance Hold blocks, who releases it | ⛔ Awaiting Sathish |
| D5 | Totals → billing / payout? Exceptions: deducted from whom, how | ⛔ Awaiting Sathish |
| D6 | Source of Indent Type and Client Operations HUB | ⛔ Awaiting Sathish |
| D7 | Which trips enter POD Pending; pre-go-live trips | ⛔ Awaiting Sathish |
| D8 | Own-fleet (no vendor) trips | ⛔ Awaiting Sathish |
| D9 | Who may Inward / Validate / Approve / Approve Invoice / Decline / release | ⛔ Awaiting Sathish |
| D10 | Reopen / reverse an approval | ⛔ Awaiting Sathish |

### B. V1 security finding — OWNER REQUIRED

- **Finding A:** `public.get_trips_for_pod_org(uuid)` is SECURITY DEFINER, executable by `authenticated`, with no caller org-membership check (confirmed from its definition on preprod). The in-app consumer is the POD Reconciliation screen (list and summary). Owner: DB/security (unassigned). Must be fixed before Debit Control reads through it. Details in [V1_FINDINGS.md](./V1_FINDINGS.md#finding-a--security-finding--owner-required).

### C. V1 audit-integrity finding — OWNER REQUIRED

- **Finding B:** `log_activity` (and `activity_logs`) is absent on preprod. V1 POD validation and POD-logged audit writes are not persisted. Owner: audit/platform (unassigned). Details in [V1_FINDINGS.md](./V1_FINDINGS.md#finding-b--audit-integrity-finding--owner-required).

### D. Other items outside this branch

- **V1-3:** `PodValidationView` overwrites `trips.client_price` from the client with no server check (changes AR/Revenue). Owner: finance (unassigned). Related to D5.
- **V1-4:** The POD `approved` ("Ready") tab and `get_pod_reconciliation_summary` reference `invoice_status_1` / `pod_status` / `total_client_value`, which are absent on preprod `trips`. Owner: POD Reconciliation (unassigned).
- **T3:** The UI gate `finance.pod_reconciliation` and the RPC surface `trip_compliance.pod.manage` disagree. Owner: RBAC (`docs/RBAC_OPERATING_MODEL.md`).
- **Prod:** none of the above was checked on prod `nafxpivddesgsrthmosv`: unknown.

---

## 1. V1 audit — evidence

| Requirement | Existing V1 support | Reusable code/path | Missing piece | Evidence |
|---|---|---|---|---|
| Completed trip → POD Pending | **Partial / contradicts.** `pod_pending` tab = "no hard-copy POD and no invoice". It never checks trip status, so non-completed trips also appear | `tripMatchesPodTab` | Rule keyed on trip Completed | `features/pod-reconciliation/services/podReconciliationService.ts:108-147` |
| POD Pending columns | Partial: trip id, date, client, vendor, from/to, LR numbers exist on the view model | `PodReconciliationTripView` | none confirmed missing | same file `:52-75` |
| Soft POD view in place | Yes: `trip_documents` rows with `document_type='pod'`, signed view URL | `PodValidationView` attachments query, `getDocumentViewUrl` | Viewer inside the POD Pending row | `PodValidationView.tsx:74-96` |
| Multi-select → Inward | Yes, in the Log Incoming PODs modal (bulk) | `LogIncomingPodsModal`, `markSelectedTripsHardCopyPodReceived` | — | `LogIncomingPodsModal.tsx:300-355`, `logPods.service.ts:274` |
| POD Received Date (user-entered, mandatory) | **No.** User picks a date preset, but the server stores `pod_received_at = now()`. The picked date only goes to `log_activity` | — | Persist the user-entered date | `20260921115001_hard_copy_pod_unification.sql` (`set pod_received_at = now()`), `logPods.service.ts:284-285` |
| Courier Name (mandatory) | Yes: `trips.pod_hard_copy_courier`, courier directory. "In hand" is allowed with no courier | `courier_partners`, `fetchCourierPartners` | Enforce no "in hand" if Sathish confirms | RPC above; `LogIncomingPodsModal.tsx:124,300-323` |
| Docket Number (mandatory) | Maybe: `trips.pod_hard_copy_awb_number`, labelled "AWB / tracking number" | same RPC | Confirm Docket = AWB (D1) | RPC above |
| Inward idempotency | Yes: row lock, returns false if already received, `trip_workflow_events` with idempotency key | `record_trip_hard_copy_pod` | — | RPC above |
| Inward audit | **Broken in V1.** `log_activity` RPC does not exist in any schema on preprod, so POD_LOGGED / POD_VALIDATED writes fail silently. `trip_workflow_events` does record `pod.hard_copy_received` | `trip_workflow_events` | Reliable audit for validation actions | `pg_proc` query → 0 rows for `log_activity` |
| POD Received tab | Yes: hard-copy received and no invoice | `tripMatchesPodTab('received')` | — | service `:128-130` |
| Indent Type (Contract / Adhoc / Spot) | **No.** No column anywhere. `trips.source` = manual / market_bid / direct_quote / mover_asset / indent (a different concept). Client-lane `spot` is a pricing model | — | Data source (D6) | preprod `trips.source` distinct values; `clientReference.constants.ts:24-31` |
| Client Operations HUB | **No.** No `hub` column or table in `public` | — | Data source (D6) | `information_schema.columns` `~ 'hub'` → 0 rows |
| Vehicle Type / Number | Number yes (`trips.vehicle_display_number`). Type not on trips; only `vehicles.vehicle_type` / `indents.vehicle_type` | — | Which source wins (T4) | `lib/database.types.ts` trips Row; preprod columns |
| Client Invoice Number "from Trips Ops" | **No trip-level field.** Only `invoices.invoice_number` linked by `invoices.trip_ids`, overlaid client-side | `withIssuedInvoiceOverlay` | Ordering question (T5) | `podReconciliationService.ts:167-176`; preprod `invoices` columns |
| 20 charge / exception fields | **No.** `trip_other_expenses` has driver-side categories (fastag, parking, food, loading, unloading…). These are not client/vendor billing charges | — | Storage (after D5) | preprod `trip_other_expenses` categories |
| Validate popup | **Contradicts doc.** Single trip only. Takes shortage/damage/penalty and **overwrites `trips.client_price` = amount − deductions** from the client. Doc says exceptions are excluded from totals | none (must not reuse the write) | New contract | `PodValidationView.tsx:245-298` |
| Decline | **No.** "Reject" only shows an alert and saves nothing | — | Whole action | `PodValidationView.tsx:240-243` |
| Approve / Approve Invoice / Balance Hold | **No.** No hold or approval status on trips. The `approved` ("Ready") tab keys on `invoice_status_1`, which **does not exist** on preprod `trips`, so the tab can never match | — | D3, D4 | preprod `trips` columns; service `:118-127` |
| Finance-ledger | AR/Revenue derived from `trips.client_price`; AP from `trips.supplier_rate`. No DB trigger posts to the ledger | `features/finance/aggregation/*`, `accountingModel.ts` | D5 | `grep client_price features/finance`; `pg_trigger` on trips |
| Permissions | UI gate `finance.pod_reconciliation`, but the inward RPC checks `trip_compliance.pod.manage`. No server function checks `finance.pod_reconciliation` | `has_member_surface` | Which capability owns Debit Control (D4/T3) | `app/pod-reconciliation/index.tsx:6`; `pg_proc` surface scan |

### Pre-existing V1 defects found

These are moved to **BLOCKERS / EXTERNAL OWNERS** above: V1-1 = Finding A, V1-2 = Finding B, then V1-3 and V1-4.

---

## 2. D1–D6

| # | Code/schema proves | Doc specifies | Still ambiguous | Status |
|---|---|---|---|---|
| **D1** Inward = existing hard-copy receipt? Docket = AWB? | One shared fact `trips.pod_received_at`. Set once by Trip Ops / Compliance / Log PODs; a second inward is a no-op. Date = server `now()`. "In hand" allowed | User-entered received date, courier and docket; all three mandatory | If Trip Ops already marked the hard copy received, is the trip already "POD Received" in Debit Control (skipping inward)? Or is Debit Control inward a separate, later event? Is Docket the AWB? | ⛔ **BLOCKED — BUSINESS DECISION REQUIRED** (decides which trips are in which tab) |
| **D2** Multi-trip Validate | Validate is single-trip today | "Select one or multiple trips → Validate"; popup shows one Trip ID; remarks "against the respective Trip ID" | One popup per trip, or one set of values for all | ✅ **SAFE DEFAULT:** step through the selected trips one popup at a time, each saved on its own. The doc's layout is per-trip, and values are never copied between trips. Sathish can widen this later without a data change |
| **D3** Where Approved trips go | No "Balance & Invoice" stage. The `approved`/Ready tab is dead (V1-4). The Invoiced tab is driven by issued invoices | Approve → "Balance & Invoice", status Approved. Approve Invoice → "Invoicing / Balance process", status Balance Hold | Same tab or two? Inside Debit Control or in the Invoicing module? Does Approve alone make a trip invoiceable? | ⛔ **BLOCKED — BUSINESS DECISION REQUIRED** |
| **D4** Balance Hold: what is held, who releases | No hold concept. Vendor/driver balance payments exist elsewhere (`payment_status`, Pay flow) | Approve Invoice and Decline → Balance Hold. Release not described | Does Hold block the vendor balance payout? Client invoicing? Both? Who releases it, with what action, and does release need re-validation? | ⛔ **BLOCKED — BUSINESS DECISION REQUIRED** |
| **D5** Totals vs finance/ledger | AR/Revenue = `client_price`, AP = `supplier_rate`. V1 Validate already overwrites `client_price` (contradicts the doc) | Totals auto-calculated, shown in popup and table. Exceptions excluded, kept "for debit/claim tracking" | Does Total Client Value replace the billed amount (AR/invoice)? Does Total Vendor Value replace the payable (AP)? Do exceptions raise debit notes / deductions against the vendor or client, or are they reference only? Who owns the accounting entry? | ⛔ **BLOCKED — BUSINESS DECISION REQUIRED** |
| **D6** Indent Type & Client Operations HUB source | Neither exists anywhere in the schema (evidence table) | Both listed as "Trips Ops" fields | Where are they captured today (outside Pulse?), and who enters them for existing trips? | ⛔ **BLOCKED — BUSINESS DECISION REQUIRED** (display "—" until defined is acceptable, but it can't be built as specified) |

**Contradictions between the doc and V1 (not silently resolved):**
- C1 — Doc: only Completed trips enter POD Pending. V1: any trip without a hard-copy POD.
- C2 — Doc: user-entered POD Received Date. V1: server time.
- C3 — Doc: exceptions excluded from totals. V1: deductions subtracted from `client_price`.
- C4 — Doc: Client Invoice Number comes from Trips Ops at validation. V1: the invoice number only exists after an invoice is issued, and Approve Invoice happens *before* invoicing.
- C5 — Doc: Decline saves data. V1: Reject saves nothing.

---

## CONTRACT STATUS

### ✅ Confirmed (from the doc, unambiguous)

- **Stages:** POD Pending → (Mark Inward) → POD Received → (Validate) → Approved / Balance Hold.
- **POD Pending** columns: Trip ID, Trip Date, LR No., From, To, Client Name, Vendor Name, Soft POD. Soft POD opens in place. Multi-select → Proceed to Inward.
- **Inward:** POD Received Date, Courier Name and Docket Number are all mandatory before Mark Inward. The same values apply to every selected trip and are stored per trip. The trip leaves POD Pending and appears in POD Received.
- **POD Received** columns: Trip ID, Trip Date, LR No., From, To, Indent Type · Client Name, Client Operations HUB, Total Client Value · Vendor Name, Vehicle Type, Vehicle Number, Total Vendor Value · Client Invoice Number, Remarks, Validated Date · Validate.
- **Validate popup:** 10 read-only trip fields. Client and vendor each have Charges (Cost, Loading, Halting, Unloading), Additional (Extra Point, Other, Special Approval) and Exceptions (Delay Delivery, Damage, Product Missing). Plus Remarks and Validated Date.
- **Totals** (non-editable, system-calculated): `Total = Cost + Loading + Halting + Unloading + Extra Point + Other + Special Approval`, computed separately for client and vendor. The 3 exceptions are **never** included and are stored separately.
- **Actions:**

| Action | Saves | Stage after | Status after |
|---|---|---|---|
| Approve | charges, exceptions, remarks, Validated Date | Balance & Invoice | Approved |
| Approve Invoice | same | Invoicing / Balance process | Balance Hold |
| Decline | same ("where applicable") | stays POD Received | Balance Hold |
| Cancel | nothing | stays POD Received | unchanged |

- **Decline is re-validatable:** "remain available for further review and validation".
- **Audit:** full per-trip history Inward → Validation → action, kept for tracking and audit.

### 🟢 Safe assumptions (no business-contract effect)

- **S1 (D2)** Multi-select Validate opens one popup per trip in sequence. Each trip is saved on its own.
- **S2** Amounts are INR, ≥ 0, 2 decimals. A blank input means 0 in the total but is stored as "not entered". Totals are computed on the server; the client value is only a preview.
- **S3** Validated Date = server timestamp of the action, not user-editable.
- **S4** Cancel makes no network write.
- **S5** Missing display data (HUB, Indent Type, Vehicle Type, Invoice No.) shows "—", never a guessed value.
- **S6** Server-enforced **state transitions**, rejected otherwise:
  - `POD_PENDING → POD_RECEIVED` via Mark Inward
  - `POD_RECEIVED(+ none | BALANCE_HOLD from Decline) → APPROVED | BALANCE_HOLD(invoice) | BALANCE_HOLD(declined)`
  - No transition out of APPROVED or BALANCE_HOLD(invoice) until D3/D4 define one
- **S7** **Idempotency:** each Mark Inward / Approve / Approve Invoice / Decline carries a client idempotency key. Repeating the same key returns the first result and makes no second write or audit row. A conflicting action on a trip that already left the allowed state is rejected with a clear error. Per-trip row lock prevents concurrent double-approval (same pattern as `record_trip_hard_copy_pod`).
- **S8** **Permissions:** every write is checked on the server (SECURITY DEFINER + `has_member_surface`), never only by the UI gate. Reads must be membership-scoped (unlike V1-1).
- **S9** V1's `PodValidationView` write path (`client_price` overwrite) and `log_activity` are **not** reused.

### ⛔ Business decisions required (Sathish)

- **D1** Is Debit Control inward the same event as the existing hard-copy POD receipt, or a separate later step? Is Docket = courier AWB? Is "in hand" allowed?
- **D3** Where do Approved and Approve-Invoice trips go (tab/module), and does Approve alone make a trip invoiceable?
- **D4** What does Balance Hold block (vendor payout, client invoicing, both)? Who releases it, and how?
- **D5** Do validated totals become the billed amount (AR) and the payable (AP), or are they stored alongside? Do exceptions create debit/claim entries, and against whom? Who owns the ledger entry?
- **D6** Where do Indent Type (Contract / Adhoc / Spot) and Client Operations HUB come from?
- **D7** Which trips enter POD Pending: only status Completed (C1)? Are trips completed before go-live included?
- **D8** Asset-only trips (own fleet, no vendor): is the Vendor section skipped?
- **D9** Which role/team may Validate / Approve / release Hold? Must it differ from the person who did the Inward (maker-checker)?
- **D10** Can an Approved trip be reopened, and by whom?

### 🔧 Technical questions (team, after D1/D5)

- **T1** Storing a user-entered POD Received Date conflicts with `record_trip_hard_copy_pod` (server `now()`, shared with Compliance). Change the shared RPC, or store it separately? Depends on D1.
- **T2** Audit store: extend `trip_workflow_events` (already idempotency-keyed) vs a dedicated table. Owner to decide; do not use `log_activity`.
- **T3** Capability: new server surface for Debit Control vs reuse `finance.pod_reconciliation`. Also resolve the mismatch with `trip_compliance.pod.manage`. Update `docs/RBAC_OPERATING_MODEL.md` + changelog.
- **T4** Vehicle Type source when `vehicle_id` is null (market trips): `indents.vehicle_type`?
- **T5** Client Invoice Number at validation time (C4): it usually does not exist yet. Show it when issued, or does Trips Ops need a new field?
- **T6** Finding A must be fixed by its owner before Debit Control reads through `get_trips_for_pod_org` (see BLOCKERS B).

---

## Proposed scope once unblocked (NOT implemented, no schema designed)

- **DB** (one migration via `supabase migration new`, after D1/D3/D4/D5): per-trip validation record (20 amounts, remarks, totals, status, actor, time, idempotency key). SECURITY DEFINER RPCs for Mark Inward and Validate-action, with state + permission + idempotency checks. Audit events. Membership-scoped read RPC.
- **Code:** `features/debit-control/` (service, queries, POD Pending / POD Received tables, Inward modal, Validation modal). Totals in a pure `*.util.ts`. The route is gated by the new capability. The existing `pod-reconciliation` screen is untouched unless D3 says the tabs merge.
- **Tests:** unit (totals exclude exceptions, blank vs 0, state machine), component (mandatory inward fields, popup Cancel writes nothing, double-submit), SQL rolled-back lifecycle (permission, idempotent retry, invalid transitions), Playwright happy path. Preprod runbook like `docs/compliance/dinesh/preprod/`.
- **Out of scope for this branch:** Findings A/B, V1-3, V1-4 (external owners — see BLOCKERS / EXTERNAL OWNERS).
