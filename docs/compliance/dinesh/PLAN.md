# Compliance Table View — Dinesh sir's changes

Source: [Dinesh Compliance.docx](./Dinesh%20Compliance.docx) · Current UI: [current-table-view.png](./current-table-view.png)
Branch: `compliance-dinesh-sir` (baseline: V1 @ 07125814) · Contract + decisions: [CONTRACT.md](./CONTRACT.md) · DB: [MIGRATION.md](./MIGRATION.md)

## Progress

| # | Change | Status |
|---|--------|--------|
| 1 | E-way Bill column | ✅ Done (code + tests) |
| 2 | Trip / Vehicle / Driver status (Pending / Approved) | ✅ Done (code + tests) |
| 3 | Action column → Verify / Decline | ✅ Code + tests done · ⛔ DB migration not applied (needs approval) |
| 4 | QA + CI gates | 🟡 Unit/component/contract pass · E2E blocked (no QA identity) · typecheck has the 37 errors V1 already had |

Overall: **3 / 4 code-complete**. The release is blocked on: applying the migration to preprod, the E2E run, and Dinesh sir's decisions D1–D3.

Legend: ⬜ Not started · 🟡 In progress / partial · ✅ Done · ⛔ Blocked

---

## 1. E-way Bill details column

- [x] Source found: `trip_documents` (`document_type='eway_bill'`), JSON in `document_number` written by Trip Detail's E-way editor
- [x] Uses the data Compliance already loads (no new query); picks the same row Trip Detail shows (newest row that parses)
- [x] New **E-way Bill** column between **To** and **Trip**: number, "Valid till <date>", "+N" for extra entries
- [x] "—" when missing; unparseable dates shown exactly as stored, never invented
- [x] Expired → red "Expired" tag (**D3 unconfirmed**, switch `HIGHLIGHT_EXPIRED_EWAY_BILL`)
- [x] Cards view unaffected
- [ ] Manual: edit E-way in Trip Detail → Table shows new values (AC-8)

## 2. Trip, Vehicle & Driver status

- [x] Approved only when every required doc is verified; otherwise Pending (missing / pending / rejected / expired)
- [x] Trip, Vehicle, Driver columns show one pill each; Theme colours only
- [x] Tap → opens that group's document review sheet
- [x] After approving, the existing cache patch + realtime updates the row (no new refresh logic needed)
- [ ] Manual: approve last doc → pill flips to Approved without reload (AC-14/15)

## 3. Action column — Verify & Decline

Verify
- [x] "Verify Docs" and "View Trip" removed; Trip ID still opens details; Pay unchanged
- [x] Verify uses the existing server-checked RPC; disabled until LR, E-way Bill, Invoice approved (**D2 unconfirmed**)
- [x] "Verifying…" state, double press ignored, verified rows show "Verified"
- [ ] E2E: trip moves to Verified tab (AC-20/21) — spec written, blocked

Decline
- [x] Modal with required reason (3–500 chars), loading, double-submit guard, inline errors
- [x] New RPC `decline_trip_compliance` stores the reason on the trip and adds an audit event; server checks permission, rejects already-verified trips, and dedupes retried submits
- [x] Trip stays in **Compliance Pending**
- [x] "Declined" + reason shown on table row, card and details screen
- [x] App keeps working before the migration is applied (falls back to the old query)
- [ ] ⛔ Apply migration `20270929162901` to preprod, then run AC-30..33 checks from MIGRATION.md

## 4. QA + CI (commands run 2026-09-29, outputs in final report)

- [x] `npx jest features/tripCompliance` → 33 suites / 381 tests pass (V1 baseline: 29 / 282)
- [x] ESLint on all changed files → 0 errors (1 existing warning in ComplianceSection.tsx)
- [x] `tsc` → 37 errors, identical to V1 baseline; none in changed lines
- [x] madge circular → 97 cycles on V1 and on this branch; none new, none in compliance files
- [x] `npm run test:navigation-policy` → 64 / 64 pass
- [x] `expo export --platform web` → builds
- [x] Full `npx jest --ci` → 396/399 suites, 2928/2934 tests pass. The 3 failing suites (sign-in, logPods concurrency, mutualConnections) fail the same way on V1 (6/6 identical) and are unrelated
- [ ] ⛔ Playwright `e2e/compliance/compliance-table.spec.ts` (7 tests) — needs `E2E_EMAIL`/`E2E_PASSWORD` for a dedicated QA identity
- [ ] Manual: narrow-width layout (AC-40), native device check
- [ ] `lib/` 60-file gate already fails on V1 (177 files); this branch adds no `lib/` files

---

## Open questions for Dinesh sir (see CONTRACT.md §4)

- **D1** — "Verify & Hold" or "Decline"? Built as **Decline** (label is a single constant).
- **D2** — Should Vehicle/Driver Pending also block Verify? Currently only Trip docs block, which is the existing server rule. Changing it needs a DB function change.
- **D3** — Show expired E-way Bills in red? Built as **yes** (single switch).
- Also for him: a verified trip that already has an advance or expired vehicle docs shows in that stage, not in "Verified" (existing V1 rule, D8). Decline does not reset doc approvals or notify Trip Ops (D7).
