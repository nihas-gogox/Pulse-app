# Implementation contract — Dinesh sir's Compliance Table changes

Branch `compliance-dinesh-sir` · base V1 `07125814` · lead-owned doc (Agent 1 may extend §5 acceptance criteria)

## 1. Baseline (verified 2026-09-29)

| Topic | Fact (source) |
|---|---|
| Table UI | `features/tripCompliance/components/ComplianceTripsTable.tsx`, mounted by `app/compliance/index.tsx:330` |
| E-way Bill data | `trip_documents` rows with `document_type='eway_bill'`; `document_number` holds JSON `{ewayNo, createdDate, validTill, docNo, entries:[…]}` written by `upsertEwayBillFields` (`features/trips/services/tripDocuments.service.ts:834`). Parse with `parseEwayFieldEntries` (`features/trips/services/ewayBillFields.util.ts`). Meta-only row path `<trip>/eway_bill/fields.json`. |
| E-way Bill in Compliance | Already loaded: `ComplianceDocumentRow.document_number` (`tripComplianceRead.service.ts:73`). No new query needed. |
| Doc statuses | Trip docs: `trip_documents.status` pending/verified/rejected. Vehicle/driver: derived by `deriveEntityComplianceRows` → missing/pending/verified/rejected/expired. |
| Verify | RPC `mark_trip_compliance_verified(p_trip_id)` — SECURITY DEFINER, surface `trip_compliance.trip.mark_verified`, server requires `lr`,`invoice`,`eway_bill` verified. Vehicle/driver docs are **not** server-gated. |
| Trip → Verified tab | Derived: `compliance_verified_at` set ⇒ stage `compliance_verified` (`deriveComplianceStage`). |
| Audit | `trip_workflow_events` (+ unique partial index on `idempotency_key`); pattern in `approve_trip_compliance_with_exception`. |
| Decline | Does not exist. No column, no RPC. |
| Live Verify RPC | Remote `pg_get_functiondef` (read-only, 2026-09-29) = the version that sets `compliance_decision='approved'` and requires lr/invoice/eway_bill. Not modified by this work. |
| Stage precedence | Balance paid > expired vehicle docs > advance > verified (`tripComplianceRead.service.ts:320-327`). A verified trip that already has an advance or expired vehicle docs lands in that stage, not "Verified". Existing V1 behaviour; unchanged. |
| E-way row choice | Correction (Agent 1): mirror Trip Detail's pick (first eway_bill row whose `document_number` parses, `useTripDetail.ts:259`), not newest-first. `validTill` stored as `DD-Mon-YY` (legacy ISO / DD-MM-YYYY); parse with `vaultDocDateToIso`. |
| Decline modal | `ComplianceInputModal` unsuitable (no validation/loading/error, hardcoded hex) → new `ComplianceDeclineModal.tsx`. |
| DB environment | No Docker → no local Supabase. `.env` → cloud project. Local and remote migration versions identical (0 drift, head `20270928114500`). **No migration will be applied by this work.** |
| Pre-existing gap | `trips` RLS lets any active org member UPDATE trips directly, so compliance columns can be written bypassing RPCs. Same for new decline columns. Out of scope; logged. |

## 2. Design

### A. E-way Bill column (UI only)
- New column **E-way Bill** between **To** and **Trip**: number (first entry with content) + "Valid till <date>".
- Pick the first `eway_bill` doc (in document order) whose `document_number` parses to an entry with content — same as Trip Detail (see §1 correction).
- Empty: "—". Unparseable date: show raw string, never fabricate. Multiple entries: show first + "+N".
- Expired (validTill < today, local date): see decision D3.

### B. Trip / Vehicle / Driver group status (UI only)
- Group = required rows only (trip: lr, eway_bill, invoice · vehicle: rc, insurance, fitness · driver: license).
- **Approved** iff every required row status === `verified`; otherwise **Pending** (covers missing, pending, rejected, expired).
- Pending = danger tone, Approved = success tone, from `Theme` only.
- Press → `onReview(tripId, null, scope)` (existing review sheet, scoped). After approve, existing pipeline patch + realtime already refresh the row.
- a11y label e.g. "Trip documents Pending, 1 of 3 approved. Open verification".

### C. Actions: Verify / Decline
- Remove "Verify Docs" and "View Trip". Keep existing **Pay** link (finance, not part of ask).
- Trip ID cell still opens details (existing), so trip navigation is not lost.
- Shown only when `complianceVerifiedAt` is null. Verified rows show a "Verified" text label.
- **Verify**: calls existing `onMarkComplianceVerified`. Disabled + hint when trip required docs not all verified (mirrors server). Loading "Verifying…", double-press guarded. Hidden when user lacks `canMarkVerified`.
- **Decline**: opens modal (reuse `ComplianceInputModal` if it fits), reason required, trimmed 3–500 chars. Calls new RPC. Trip stays in Compliance Pending. Row shows "Declined" pill + reason (truncated, full in a11y/tooltip).

### D. Backend (new migration, forward-only)
- `trips` + `compliance_declined_at timestamptz`, `compliance_declined_by uuid references auth.users(id)`, `compliance_decline_reason text` with check `char_length between 3 and 500` (nullable).
- RPC `decline_trip_compliance(p_trip_id uuid, p_reason text, p_idempotency_key text default null)` — SECURITY DEFINER, `set search_path = public`, surface `trip_compliance.trip.mark_verified` (same actors who decide approval; no new grant), `select … for update`, error if trip already `compliance_verified_at` not null, validates reason, writes columns, inserts `trip_workflow_events` `compliance.declined` with payload `{reason, previous_reason}`; idempotency key `trip_id || ':compliance.declined:' || p_idempotency_key` — on unique_violation roll back to no-op (duplicate submit ⇒ no second event and no overwrite).
- `mark_trip_compliance_verified` and `approve_trip_compliance_with_exception` **not modified**. A declined-then-verified trip keeps decline columns as history; UI treats decline as active only while `compliance_verified_at` is null.
- Grants: `execute` to authenticated, revoke from public.
- Migration filename: `20270929HHMMSS_trip_compliance_decline.sql` (non-`000000`, sorts after remote head). `supabase migration new` would produce `2026…`, which sorts before the remote head and forces `--include-all`. Logged in decision log.
- Rollback: compensating migration drops function + columns (documented in `MIGRATION.md`).

### E. Client data plumbing
- `ComplianceTripFlags` + `ComplianceTripSummary` gain `complianceDeclinedAt/By/Reason`.
- `fetchComplianceTripFlags`: select with decline columns; on missing-column error retry the existing select (so the app keeps working before the migration is applied). Never drop verified flags.
- `declineTripCompliance({tripId, reason, idempotencyKey})` in `tripComplianceWrite.service.ts`, maps errors like `markTripComplianceVerified`.
- Pipeline cache patch `applyComplianceDeclined` + realtime/invalidation so Cards, Table, Details reflect it.

## 3. File ownership (no one edits another's files)

| Agent | Owns |
|---|---|
| 1 Requirements | `docs/compliance/dinesh/CONTRACT.md` §5 only (read-only everywhere else) |
| 2 DB/backend | `supabase/migrations/20270929*_trip_compliance_decline.sql`, `docs/compliance/dinesh/MIGRATION.md`, `features/tripCompliance/services/tripComplianceWrite.service.ts`, `features/tripCompliance/services/tripComplianceRead.service.ts`, `features/tripCompliance/tripCompliance.types.ts`, `lib/database.types.ts` (hand-add only the new columns/RPC) |
| 3 UI | `features/tripCompliance/components/ComplianceTripsTable.tsx`, new `features/tripCompliance/components/ComplianceDeclineModal.tsx` (if `ComplianceInputModal` unsuitable), new `features/tripCompliance/utils/complianceTableStatus.util.ts`, new `features/tripCompliance/complianceDecisionConfig.ts` |
| 4 Integration | `app/compliance/index.tsx`, `features/tripCompliance/utils/compliancePipelinePatch.util.ts`, `features/tripCompliance/hooks/useComplianceTripsQuery.ts`, `features/tripCompliance/services/compliancePipelineSync.service.ts`, `features/tripCompliance/components/ComplianceTripCard.tsx`, `features/tripCompliance/screens/ComplianceDetailsScreen.tsx` |
| 5 QA | `features/tripCompliance/__tests__/**` (new files), `e2e/compliance/**`. No production files. |
| Lead | `docs/compliance/dinesh/PLAN.md`, commits, integration fixes |

## 4. Decision log (UNCONFIRMED — proposed defaults, not approved requirements)

| # | Question | Proposed default | Why / consequence | Switch |
|---|---|---|---|---|
| D1 | Label "Verify & Hold" vs "Decline" | **Decline** | Doc body, sub-heading and flow all say Decline; only the section title says Hold. Label only — behaviour identical. | `COMPLIANCE_DECLINE_ACTION_LABEL` in `complianceDecisionConfig.ts` |
| D2 | Is Verify blocked until all docs approved? | **Blocked until Trip docs (LR, E-way, Invoice) approved** — current server rule. Vehicle/Driver Pending does **not** block. | Keeps existing, server-enforced V1 rule; no business-rule change shipped. If Dinesh sir wants Vehicle/Driver to block too, that needs a server RPC change (not a client flag) to be enforceable. | None (deliberate); needs his answer |
| D3 | Expired E-way Bill in red? | **Yes: red "Expired" tag next to date** | Display only, no data or workflow effect; flags a real legal risk. Easy to turn off. | `HIGHLIGHT_EXPIRED_EWAY_BILL` in `complianceDecisionConfig.ts` |
| D4 | Migration timestamp | `20270929…` not `supabase migration new` | Remote head is future-dated `20270928114500`; a 2026 stamp would be out of order. Still non-midnight (no collision with pulse-unified-base). | — |
| D5 | Decline after decline | Allowed; replaces current reason, history kept in `trip_workflow_events` | Lets reviewer update reason. | — |
| D7 | Does Decline reset doc statuses or notify Trip Ops? | **No** — records reason only | Not in the doc; resetting approvals would be a material rule change. Notification can be added later. | — |
| D8 | Verified trip with advance/expired docs | Shows in its payment/docs stage, not "Verified" (V1 rule) | Doc says "moves to Verified page"; true for unpaid trips with valid vehicle docs. | — |
| D6 | Who can Decline | Same surface as Verify (`trip_compliance.trip.mark_verified`) | No new permission to configure. | — |

## 5. Acceptance criteria
Each AC is one observable check. `[D#]` = depends on an unconfirmed decision in §4.

**A. E-way Bill column**
- AC-1: Table header order is `… From | To | E-way Bill | Trip | Vehicle | Driver …`; no other column moves or disappears.
- AC-2: For a trip whose E-way editor saved `ewayNo=1234 5678 9012`, `validTill=04-Sep-26`, the cell shows `1234 5678 9012` and `Valid till 04-Sep-26` without opening the row.
- AC-3: `validTill` is stored as `DD-Mon-YY` (`formatVaultDocDate`); the cell parses it via `vaultDocDateToIso` and shows the stored text; unparseable values are shown raw, never replaced by a made-up date.
- AC-4: Trip with no `eway_bill` row, or rows with no `ewayNo`/`validTill`, shows `—` in the cell (no crash, no "Invalid Date").
- AC-5: Trip with 3 E-way entries shows the first entry plus `+2`; the row picked is the same one Trip Detail shows (`useTripDetail`: first row whose `document_number` parses to ≥1 entry).
- AC-6: Only number but no date → number and `Valid till —`; only date → `—` and the date.
- AC-7: `validTill` before today (local date) shows a red `Expired` tag; today or later shows no tag; with `HIGHLIGHT_EXPIRED_EWAY_BILL=false` no tag ever. [D3]
- AC-8: Editing E-way fields in Trip Detail, then returning to Table view, shows the new values with no manual reload.

**B. Trip / Vehicle / Driver status**
- AC-9: Trip/Vehicle/Driver cells show a single status (`Pending` or `Approved`) and no longer list document names (`LR/Eway Bill/Invoice`, `RC/…`).
- AC-10: `Approved` (success tone) only when every required row of that group is `verified` (trip: lr, eway_bill, invoice · vehicle: rc, insurance, fitness · driver: license); any missing/pending/rejected/expired required row → `Pending` (danger tone). Optional docs never affect the status.
- AC-11: Colors come from `Theme` tokens only (no hex/rgba literals in the new code).
- AC-12: Trip with no vehicle (or no driver) assigned shows `Pending` for that group, and pressing it opens the sheet's existing "unassigned" state (not a crash).
- AC-13: Pressing a status opens `ComplianceDocumentReviewSheet` with `scope` = that group and the document list (documentKey null) — Vehicle status lists RC/Insurance/Fitness, Driver lists License, Trip lists LR/E-way/Invoice.
- AC-14: Approving the last pending required doc in the sheet, then closing it, flips that cell to `Approved` without reload or tab switch.
- AC-15: A rejected or newly expired required doc flips an `Approved` cell back to `Pending` after refresh/realtime.

**C. Actions: Verify / Decline**
- AC-16: Action column no longer contains `Verify Docs` or `View Trip`; `Pay` behaves exactly as before; tapping the Trip ID still opens trip details.
- AC-17: Unverified trip shows `Verify` and the decline action labelled `Decline` (`COMPLIANCE_DECLINE_ACTION_LABEL`). [D1]
- AC-18: User without `trip_compliance.trip.mark_verified` sees neither Verify nor Decline. [D6]
- AC-19: Verify is disabled with a visible hint while any of LR / E-way / Invoice is not verified; Vehicle/Driver `Pending` does not disable it. [D2]
- AC-20: Pressing Verify on an eligible trip shows `Verifying…`, ignores a second press, and the trip leaves the Compliance Pending list and appears under the Verified stage filter, with no reload.
- AC-21: If the Verify RPC fails (e.g. server says docs not verified), the row stays put, the button re-enables, and the error message is shown.
- AC-22: Verified trips show a `Verified` label instead of Verify/Decline.
- AC-23: Pressing Decline opens a modal with a reason field; Submit is disabled for empty, whitespace-only, <3 or >500 trimmed chars, with a character hint.
- AC-24: Cancel / backdrop / Escape (web) / Android back closes the modal with no RPC call and nothing saved.
- AC-25: Submitting a valid reason shows a loading state, blocks double-submit, closes on success, and the trip stays in Compliance Pending (same stage as before).
- AC-26: The declined row shows a `Declined` pill with the reason truncated; full reason is available via tooltip (web) and the a11y label.
- AC-27: Declining an already-declined trip replaces the shown reason with the new one. [D5]
- AC-28: A declined trip that is later verified shows `Verified` and no `Declined` pill.
- AC-29: Decline RPC error (network, not authorized, already verified) keeps the modal open with the typed reason and shows the error.

**D. Persistence, propagation, auth**
- AC-30: After decline, `trips.compliance_declined_at/by/reason` hold now / caller uid / trimmed reason, and exactly one `trip_workflow_events` row `compliance.declined` with `{reason, previous_reason}` exists for that submit.
- AC-31: Replaying the same idempotency key creates no second event and does not overwrite the reason.
- AC-32: `decline_trip_compliance` raises for: caller without the surface / other org, trip not found, trip already verified, reason outside 3–500 chars after trim — and changes nothing in each case.
- AC-33: Decline reason and status survive app reload and are visible to another user of the same org (Table, Card, Details).
- AC-34: Before the migration is applied, the Compliance page still loads and verified flags still show (decline columns absent → fallback select).
- AC-35: `mark_trip_compliance_verified` and `approve_trip_compliance_with_exception` behave exactly as before (existing tests pass; no definition change in the new migration).
- AC-36: `anon` cannot execute `decline_trip_compliance`; `authenticated` can (grant check).

**E. UX / a11y**
- AC-37: Status cells have `accessibilityRole="button"` and a label like "Trip documents Pending, 1 of 3 approved. Open verification".
- AC-38: Verify/Decline/status touch targets are ≥44pt; the disabled Verify exposes `accessibilityState.disabled` and its hint text to screen readers.
- AC-39: Decline modal: input auto-focused, labelled, multiline; submit button announces busy state while saving.
- AC-40: Table still scrolls horizontally on narrow web/mobile widths with the new column; no header/cell misalignment.
- AC-41: `npm run lint`, `npm run typecheck`, `npm test` pass; no new madge cycle; no new `lib/` file.
