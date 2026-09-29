# Debit Control — Sathish's POD Management & Validation Workflow

Source: [Debit Control - Sathish.docx](./Debit%20Control%20-%20Sathish.docx)
Branch: `debit-control-sathish` (baseline: V1 @ f6cb238a) · Contract + decisions: CONTRACT.md (to write) · DB: MIGRATION.md (to write)

## Progress

| # | Change | Status |
|---|--------|--------|
| 1 | POD Pending list (completed trips, Soft POD viewer, multi-select) | ⬜ Not started |
| 2 | Proceed to Inward → Mark Inward (date, courier, docket; bulk) | ⬜ Not started |
| 3 | POD Received list (trip / client / vendor / other columns) | ⬜ Not started |
| 4 | Validation popup (client + vendor charges, exceptions, totals, remarks) | ⬜ Not started |
| 5 | Actions: Approve / Approve Invoice / Decline / Cancel + status | ⬜ Not started |
| 6 | Audit history (Inward → Validation → Action per trip) | ⬜ Not started |
| 7 | QA + CI gates | ⬜ Not started |

Overall: **0 / 7**.

Legend: ⬜ Not started · 🟡 In progress / partial · ✅ Done · ⛔ Blocked

---

## Existing code to build on (V1)

- `app/pod-reconciliation/` + `features/pod-reconciliation/PodReconciliationScreen.tsx` — already has tabs `pod_pending` / `received` / `approved` / `invoiced`
- `features/pod-reconciliation/components/PodValidationView.tsx` — existing validation view (scope vs doc: unknown)
- `features/log-pods/components/LogIncomingPodsModal.tsx` — existing inward modal: received date, courier (partner directory), AWB
- `features/trips/services/tripDocumentLrPod.service.ts` — LR/POD index (Soft POD source)
- `features/invoicing/utils/financeWorkflowState.util.ts` — current POD/invoice status labels

## 1. POD Pending

- [ ] Completed trips appear automatically (confirm current `pod_pending` rule matches "trip Completed")
- [ ] Columns: Trip ID, Trip Date, LR No., From, To, Client Name, Vendor Name, Soft POD
- [ ] Soft POD opens the uploaded file in place (no jump to Trips Ops)
- [ ] Select one or many → **Proceed to Inward**

## 2. POD Inward

- [ ] Form: POD Received Date, Courier Name, Docket Number — all required before **Mark Inward**
- [ ] Same details applied to every selected trip
- [ ] Stored per trip; trips leave POD Pending and appear in POD Received
- [ ] Reuse `LogIncomingPodsModal` if its fields map (Docket = AWB?) — see D1

## 3. POD Received

- [ ] Trip: Trip ID, Trip Date, LR No., From, To, Indent Type (Contract / Adhoc / Spot)
- [ ] Client: Client Name, Client Operations HUB, Total Client Value
- [ ] Vendor: Vendor Name, Vehicle Type, Vehicle Number, Total Vendor Value
- [ ] Other: Client Invoice Number, Remarks, Validated Date
- [ ] Select one or many → **Validate**

## 4. Validation popup

- [ ] Trip info read-only (10 fields from Trips Ops)
- [ ] Client: Charges (Cost, Loading, Halting, Unloading), Additional (Extra Point, Other, Special Approval), Exceptions (Delay Delivery, Damage, Product Missing)
- [ ] Client Invoice Number auto-fetched from Trips Ops
- [ ] Vendor: same 10 fields
- [ ] Total = Charges + Additional (7 fields); Exceptions excluded; read-only; shown in popup and table
- [ ] Remarks stored per Trip ID, shown in table
- [ ] Multi-trip validate behaviour — see D2

## 5. Actions & status

| Action | Next stage | Status |
|---|---|---|
| Approve | Balance & Invoice | Approved |
| Approve Invoice | Invoicing / Balance process | Balance Hold |
| Decline | Stays in POD Received | Balance Hold |
| Cancel | Close, nothing saved | — |

- [ ] Every action except Cancel saves charges + remarks + Validated Date
- [ ] Server-side permission check + double-submit guard

## 6. Audit

- [ ] Full history per trip: Inward → Validation → Approve / Approve Invoice / Decline (who, when, values)

## 7. QA + CI

- [ ] Unit tests: totals formula, status transitions
- [ ] Component tests: inward form validation, popup
- [ ] ESLint, typecheck (no new errors vs V1), madge, `test:navigation-policy`
- [ ] Migration via `supabase migration new`, `npm run db:preflight`, preprod only after explicit approval

---

## Open questions for Sathish (to move into CONTRACT.md)

- **D1** — Is "Docket Number" the same as the existing courier AWB field? Is "In hand" (no courier) allowed?
- **D2** — Multi-trip Validate: one popup per trip in sequence, or one set of values applied to all?
- **D3** — Where does "Balance & Invoice" live — the existing `approved` ("Ready") tab, or a new stage?
- **D4** — Approve Invoice vs Decline both give "Balance Hold": what releases the hold, and who?
- **D5** — Do validated Client/Vendor totals replace the trip's freight amounts in finance/ledger, or are they stored alongside only?
- **D6** — Source of "Client Operations HUB" and "Indent Type" on the trip: unknown until checked.
