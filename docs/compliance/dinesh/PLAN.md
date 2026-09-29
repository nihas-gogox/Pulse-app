# Compliance Table View — Dinesh sir's changes

Source: [Dinesh Compliance.docx](./Dinesh%20Compliance.docx) · Current UI: [current-table-view.png](./current-table-view.png)
Branch: `compliance-dinesh-sir` (baseline: V1 @ 07125814)
Main file: `features/tripCompliance/components/ComplianceTripsTable.tsx`

## Progress

| # | Change | Status |
|---|--------|--------|
| 1 | E-way Bill column | ⬜ Not started |
| 2 | Trip / Vehicle / Driver status (Pending / Approved) | ⬜ Not started |
| 3 | Action column → Verify / Decline | ⬜ Not started |
| 4 | QA + CI gates | ⬜ Not started |

Overall: **0 / 4**

Legend: ⬜ Not started · 🟡 In progress · ✅ Done · ⛔ Blocked

---

## 1. E-way Bill details column

Trip Ops enters E-way Bill details on the Trips page. Show them in the Compliance table.

- [ ] Find where E-way Bill number + expiry are stored (not in `lib/database.types.ts` — source unknown)
- [ ] Load E-way Bill number + expiry into the compliance trips query
- [ ] Add a new **E-way Bill** column between **To** and **Trip**
- [ ] Show number + expiry date; show "—" when missing
- [ ] Check cards view is unaffected

## 2. Trip, Vehicle & Driver status

Replace the document lists (LR / E-way Bill / Invoice, RC / Insurance / FC, Driving License) with a single status.

- [ ] Work out overall status per group: **Approved** only when every required doc is approved, otherwise **Pending**
- [ ] Trip column: Pending (red) / Approved (green)
- [ ] Vehicle column: same
- [ ] Driver column: same
- [ ] Colors from `Theme` (no hardcoded hex)
- [ ] Tapping the status opens that group's document verification page
- [ ] After approving docs and returning, table shows Approved without manual refresh (query invalidation / realtime)

## 3. Action column — Verify & Decline

Remove **Verify Docs** and **View Trip**. Keep only **Verify** and **Decline**.

Verify
- [ ] Verify marks the trip compliance-verified (reuse existing mark-verified logic)
- [ ] Trip leaves **Compliance Pending** and appears in **Verified**; tab counts update

Decline
- [ ] Decline opens a modal asking for a reason (required — can't submit empty)
- [ ] Store the reason against the trip (who + when) — needs a new column/table → migration via `supabase migration new`, `npm run db:preflight` before push
- [ ] Trip stays in **Compliance Pending** after Decline
- [ ] Show decline status/reason in the row (and/or details) for tracking

## 4. QA + CI

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check on web table view: all three changes, empty/missing data, Verify + Decline flows
- [ ] Update this file's progress table

---

## Open questions for Dinesh sir

- Section 3 heading says **"Verify & Hold"** but body says **Verify / Decline** — confirm the button label is "Decline".
- Is the Verify button allowed when Trip/Vehicle/Driver are still Pending, or disabled until all Approved?
- Should an expired E-way Bill be highlighted (e.g. red)?
- After a Decline, can the trip be verified later, and should the reason be cleared?
