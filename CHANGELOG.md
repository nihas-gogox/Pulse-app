# Changelog — V1 (v0.0.01)

How `V1` was built, step by step, from Vasanth sir's baseline. Newest step at the bottom.
Team workflow and environments: [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

```
Vasanth sir V1  80589762
   │
   ├─ + Adhi fixes ───────────────► V1 a8f87e08   (baseline for Praveen + Sneha)
   │                                  │
   │                                  ├─ + docs ──► V1 8c28bf9c
   │                                  │
   │        Praveen compliance-flow ──┴─► v0.0.01-v1-praveen-compliance-e2e-20260925-1530  c78a1190
   │                                        │
   │        Sneha compliance-ui ────────────┴─► v0.0.01-v1-sneha-compliance-ui-merge-20260925-1553
   │                                              │
   └──────────────────────────────────────────────┴─► V1 787312c1
```

---

## 1. Baseline — Vasanth sir's V1

- **Source:** `Vasanthgogox/Pulse-app` → `V1` at `80589762448009f6a8b61d6a1a0d84998b037477`
- **Last commit:** `80589762 fix(infra): shared origin circuit + batch-query fail-fast for DB pressure`
- Starting point for everything below.

## 2. Adhi fixes → V1 `a8f87e08` (2026-09-23)

Branch `new-fix-adhi` (`e49fb71f..06416244`), squashed onto the baseline:

- `e49fb71f` Requests Moderator for DB request efficiency
- `c45ce127` finance: correct `LEDGER_TX_COLUMNS` to the real `transactions` columns
- `dba895ba` analytics: restore the PermissionGate `mode` prop name
- `06416244` netlify: exempt `VITE_*` public Supabase vars from secrets scanning

Conflicts resolved:
- `lib/supabase.ts`: kept V1's circuit breaker; the moderator wraps V1's fetch.
- `logPods.service.ts`: kept V1's courier/AWB handling (avoids a duplicate POD RPC).
- `tripComplianceRead.service.ts`: kept V1's typed fallback.

**`a8f87e08` is the baseline Praveen and Sneha branched from.**

Full detail of Adhi's changes: [Appendix](#appendix--adhi-fixes-detail-original-new-fix-adhi-changelog).

Also on V1 after this: `149fba7d` and `8c28bf9c` (team git workflow doc only, no code).

## 3. Praveen — compliance flow

**Branch:** `v0.0.01-v1-praveen-compliance-e2e-20260925-1530`, from V1 `8c28bf9c` + `praveen/compliance-flow` @ `1587f72d` (merge `c78a1190`, no conflicts).
It supersedes the earlier squash branch `v0.0.01-v1-post-praveen-compliance-merge-20260923-1839` (`85e8a724`).

What it adds:
- One-tap **Verify Docs** on the compliance card and table: marks the trip compliance-verified once all required docs are approved.
- Trip vault: **Memo** document type, e-way bill upload, invoice number formatting, driver identity docs in trip detail.
- Loading slip and manifest removed from the required compliance document types.
- Vehicle document expiry: expired/expiring alerts; an expired doc moves the trip to Pending Docs.
- Compliance queue paging (30 per page) and document approval/status fixes.

**Migration:** `20270925110000_trip_documents_memo_type.sql` (allows `memo` on `trip_documents`). **Already applied on the preprod DB**; not yet checked on prod.

Checked: compliance/trips/drivers tests pass (560); tested end to end on preprod.

## 4. Sneha — compliance UI

**Branch:** `v0.0.01-v1-sneha-compliance-ui-merge-20260925-1553`, from step 3 + `sneha/compliance-ui` @ `ba9de198`.
Sneha branched from `85e8a724`, so 7 files conflicted with Praveen's newer work. **Resolved by decision, not automatically:**

| Area | Kept |
|---|---|
| Compliance card | **Sneha's UI**, plus Praveen's one-tap Verify Docs (styled as her Pay button) and vehicle expiry alerts |
| Compliance screen | **Sneha's UI** (header subtitle removed), with Praveen's paging and fresh review data |
| Document review sheet | **Sneha's UI**: Pending/Verified columns, one Approve/Decline bar per group. Praveen's logic: vehicle docs are marked verified on approve, RC needs no expiry, Upload shows for any signed-in user. Trip verify happens from the card, so the sheet has no Mark Verified button |
| Table view | **Praveen's** |
| Review rules | Verified docs show no Approve/Decline (Praveen) |

Sneha's commits:
- `2cd2710a` compliance screen summary metrics and UI improvements
- `808db017` compliance components and new utility functions
- `530ffb4d` remove SummaryMetricCard, streamline the ComplianceScreen layout
- `ba9de198` `showAvatar` prop on PartyChip

Two of Sneha's checklist tests were updated from 6 to 5 trip documents (loading slip and manifest no longer exist).
No migrations.

Checked: compliance tests pass (238), navigation policy tests pass (64), lint clean on compliance files.
UI checked manually by Nihas before merging to V1.

## 5. → V1

**2026-09-25:** step 4 fast-forwarded into Nihas's `V1` at `787312c1` and pushed (deploys to GX Pulse preprod). Next: Vasanth sir merges it to prod (`Vasanthgogox/Pulse-app` `V1`).

### Known open items before prod
- Type check has 29 errors repo-wide. Most were already on V1; 2 come from Praveen's code (`useComplianceTripsQuery.ts` duplicate key, `tripComplianceRead.service.ts` null argument).
- Lint errors in `TripDetailScreen.tsx` (unused imports/vars) from Praveen's code.
- Apply the memo migration on the **prod DB** before Praveen's code goes live.
- The review sheet no longer shows a document's expiry date or upload file name (dropped with Sneha's UI). Expiry is still prompted on upload and enforced by the card alerts.

---

## Full commit graph — V1

Every commit on `V1` from Vasanth sir's baseline (`o` = baseline, not part of this range) up to `4f238a03`.
Regenerate with:
`git log --graph --format='%h %ad %an — %s' --date=short --boundary 80589762..V1`

How to read it: the left line is `V1`. The middle line is Praveen's branch, which also pulled in the earlier squash `85e8a724`. The right line is Sneha's branch, which started from `85e8a724`.

```
* 4f238a03 2026-09-25 NihasCM — docs(changelog): record compliance merge into V1 (787312c1)
*   787312c1 2026-09-25 NihasCM — merge(v0.0.01): bring sneha compliance-ui (85e8a724..ba9de198) onto praveen compliance
|\
| * ba9de198 2026-09-25 sneha — feat(compliance): add showAvatar prop to PartyChip for conditional avatar display
| * 530ffb4d 2026-09-25 sneha — refactor(compliance): remove SummaryMetricCard and streamline ComplianceScreen layout
| * 808db017 2026-09-24 sneha — feat(compliance): enhance compliance components and add new utility functions
| * 2cd2710a 2026-09-23 sneha — feat(compliance): enhance compliance screen with summary metrics and UI improvements
* |   c78a1190 2026-09-25 NihasCM — merge(v0.0.01): bring praveen compliance-flow (a8f87e08..1587f72d) onto V1
|\ \
| * | 1587f72d 2026-09-25 praveen-ggx — feat(compliance): implement trip compliance verification functionality
| * | b01029b3 2026-09-25 praveen-ggx — fix(compliance): update compliance review actions and document handling
| * | 2a896f2d 2026-09-25 praveen-ggx — refactor(compliance): remove loading slip and manifest from compliance document types
| * | 55f372a7 2026-09-25 praveen-ggx — feat(trip-detail): enhance document handling and user interaction in trip panels
| * | 9ddf0d83 2026-09-25 praveen-ggx — feat(trip-detail): add invoice number formatting and enhance trip document handling
| * | cb2f6da7 2026-09-25 praveen-ggx — feat(trip-detail): enhance trip details modal and refactor trip details handling
| * | e24be2e8 2026-09-25 praveen-ggx — feat(trip-details): add memo document type and enhance trip detail management
| * | 0691dc33 2026-09-24 praveen-ggx — feat(compliance): update document approval logic and status handling
| * | 7f2497c3 2026-09-24 praveen-ggx — feat(compliance): enhance compliance trip handling and document management
| * | bcd2c05b 2026-09-24 praveen-ggx — feat(trip-detail): enhance e-way bill upload functionality and UI
| * | dac9a84d 2026-09-24 praveen-ggx — feat(driver-documents): implement driver identity document handling in trip detail
| * | 6699b4ad 2026-09-24 praveen-ggx — feat(compliance): enhance vehicle document expiry handling and user notifications
| * | 4a7c11d5 2026-09-24 praveen-ggx — refactor(trip-detail): enhance document upload handling and user alerts
| * | ccba1346 2026-09-23 praveen-ggx — refactor(compliance): enhance compliance trip handling and pagination
| * | 36fc60dc 2026-09-23 praveen-ggx — merge(nihas): 85e8a724 v0.0.01 praveen compliance onto V1
| |\|
| | * 85e8a724 2026-09-23 NihasCM — merge(v0.0.01): bring praveen compliance-flow (80589762..4a400fbd) onto V1
| * | 4a400fbd 2026-09-23 praveen-ggx — refactor(compliance): standardize import formatting and enhance code organization
| * | f33abc40 2026-09-23 praveen-ggx — feat(compliance): enhance compliance document handling and UI improvements
* | | 8c28bf9c 2026-09-25 NihasCM — docs(workflow): correct prod source to Vasanthgogox/Pulse-app V1
* | | 149fba7d 2026-09-24 NihasCM — docs(workflow): add team git workflow, environments and changelog
| |/
|/|
* | a8f87e08 2026-09-23 NihasCM — merge(v0.0.01): bring new-fix-adhi fixes (e49fb71f..06416244) onto V1
|/
o 80589762 2026-09-22 Vasanth — fix(infra): shared origin circuit + batch-query fail-fast for DB pressure
```

---

## Appendix — Adhi fixes detail (original `new-fix-adhi` changelog)

DB request efficiency work: a Requests Moderator gateway, query-shape fixes,
and a pass over the repo's failing test / typecheck / lint gates.

**No database or schema changes.** No migrations, no SQL, no edits to remote
schema. Everything here is client-side.

| Gate | Before | After |
|------|--------|-------|
| Jest | 2386 passing / 28 failing, 10 failing suites | **2418 passing / 0 failing, 319/319 suites** |
| Typecheck | 250 errors | **0** |
| Lint | 139 errors / 347 warnings | 95 errors / 351 warnings |
| `madge --circular` | 8 | 8 (unchanged — none added) |
| Web production build | — | passes |

The test total rises from 2414 to 2418 because four suites previously failed to
*run* (ESM parse errors, a missing test wrapper), so their cases were never
counted. Nothing was added to inflate the number.

---

### 1. Requests Moderator (new)

`lib/platform/moderator/` — ~640 LOC + ~680 LOC of tests. Fills the
`packages/platform/gateway` role that was previously a README stub
("Every client request enters here. Implementation: TBD").

Sits **below** TanStack Query and **above** `supabase()`. It is not a cache and
does not duplicate query state — it governs the request *stream*:

| Capability | What it does |
|---|---|
| Concurrency ceiling | Semaphore bounding in-flight DB requests per device (default 6) |
| Priority lanes | `interactive` / `background` / `bulk`; background yields under load |
| Coalescing | Duplicate in-flight reads collapse to one round-trip |
| Circuit breaker | Sheds background/bulk on repeated 5xx / statement timeouts |
| Shape guard | Flags unbounded and `select=*` reads in dev |
| Invalidation debounce | Batches realtime-driven `invalidateQueries` on a ~100 ms window |

**Ships inert.** `observeOnly: true` by default: it counts everything and
governs nothing, so it lands with no behaviour change. Rollout order and the
config lines to enable each stage are in
[`docs/DB_LOAD_ARCHITECTURE_REVIEW.md`](docs/DB_LOAD_ARCHITECTURE_REVIEW.md) §4.

#### Files
- `types.ts` — config + metrics shapes
- `requestModerator.ts` — semaphore, lanes, coalescing, breaker
- `requestClassifier.ts` — derives lane / coalesce key / shape violations from the PostgREST URL
- `invalidationScheduler.ts` — invalidation debouncer
- `moderatedFetch.ts` — for Edge Function calls that bypass the supabase-js client
- `index.ts` — public surface

#### Wiring
- `lib/supabase.ts` — moderated `global.fetch`. Auth, storage and realtime
  bypass moderation deliberately (queuing a token refresh behind data reads is
  how a recovering client deadlocks).
- `lib/platform/scalability/platformHealth.ts` — moderator counters exposed via
  `getPlatformHealthSnapshot()`.

#### Coverage
Verified by an integration test driving a real `supabase-js` client, not by
inspection: `.from().select()`, `.rpc()`, insert/update/delete, and
`.functions.invoke()` all pass through. The 3 raw `fetch()` calls to Edge
Functions (`validate-gstin`, `penny-drop`, `biometric-verify`) were converted to
`moderatedFetch`. A repo grep for raw fetch against the Supabase backend now
returns none.

**Known accepted bypass:** `app/audit/index.tsx` builds its own client from a
CDN script. Web-only dev diagnostic, not in the mobile bundle.

#### Write-path safety (defect found during the coverage audit)
Writes were eligible for a caller-supplied `background`/`bulk` lane, so an open
circuit breaker could **shed a write** — losing a trip status, payment or POD.
Now any non-GET/HEAD request is forced into `interactive` and is never
coalesced. Locked by `__tests__/writeSafety.test.ts`.

---

### 2. Query efficiency

- **`features/finance/services/finance.service.ts`** — ledger reads select ~19
  explicit columns instead of `select("*")` on the widest, hottest table.
  `getTripLedgerEmbed` wrapped in `runSingleflight` so a realtime burst across
  distinct trips shares one in-flight request per trip.
  **Deliberately left unbounded:** `getAllTransactionsByOrganizationForTotals`.
  A row cap was attempted and reverted — the Cash tab's grand total must reflect
  every row, with filtered totals derived client-side from that complete set.
  Capping silently truncates headline figures for large orgs (a previously
  confirmed release blocker, guarded by its own test). The proper fix is a
  server-side SUM aggregate, which needs a migration and is out of scope.
- **`lib/queries/useRealtimeInvalidation.ts`** — trips and transactions
  invalidation bursts routed through the debouncer.
- **`useClientsQuery` / `useSuppliersQuery` / `useDriversQuery`** —
  `STALE.moderate` → `STALE.slow`. These are near-static lookups already
  invalidated by mutations and realtime, so no freshness is lost.

---

### 3. Bugs found and fixed

Each of these was surfaced by a gate that had been failing long enough to look
like noise.

| Bug | Impact |
|---|---|
| `DriverLevelProgressionScreen` called `subscribeSharedPostgresChanges` without importing it | Screen would throw as soon as a driver's IDs resolved |
| `trip_compliance.*` surfaces used `anyOfCaps` as both the org gate **and** the grant set | Granting a **finance** member the Compliance tab also conferred `dispatch` + `dispatch_for_own_fleet` (privilege leak). Fixed with explicit `grantsCaps`; logged in `docs/RBAC_OPERATING_MODEL_CHANGELOG.md` |
| `markSelectedTripsHardCopyPodReceived` passed a timestamp where POD metadata was expected (2 call sites) | Courier name and AWB the user typed were **silently discarded** on every bulk POD mark |
| `MAP_PING_DOT_HTML` referenced but never defined | GPS ping marker would throw on web maps. Constant recovered from `6ba500e6` |
| `invoiceCnDn.service.ts` imported `../invoicing.service` | Wrong path — the module is a sibling (`./`) |
| `/reach/inbox` route had no navigation-policy entry | Route shipped with no access rules attached |

---

### 4. Typecheck: 250 → 0

**One line caused 202 of the 250.** Two web-only CSS properties
(`outlineStyle: "none"`) in `PodReconciliationScreen.tsx` broke
`StyleSheet.create`'s type inference, so *every* `styles.*` reference in that
2,400-line file reported "No overload matches this call". Cast via `object`,
matching the repo's existing pattern for web-only CSS.

The remaining ~48 were spread thin. Representative fixes:

- **Derived fields typed as such** — `execution_plan_id` added as optional to
  `TripRow` and `IndentRow`. It is resolved at read time from joined indents;
  it is **not** a column on `trips` or `indents` (verified against
  `database.types.ts` and the migration history).
- **Signatures widened to match runtime** — `isTripCompleted`,
  `resolveGiveLoadClient`, `indentDisplayOriginDest` all declared
  `Pick<Row, …>` but callers legitimately pass nullable values the bodies
  already normalize.
- **`groupInvoiceRevenueCnDn` made generic** so callers passing the richer
  `TripAdjustment` keep `trip_id` through to the edit callback.
- **`chatDocumentHub.service.ts`** — keys cast to `VehicleComplianceDocType`
  instead of `keyof VehicleDocuments`; the latter includes `extras: []`, which
  widened every entry and broke `.url` / `.uploadedAt`.
- **`DriverWorkOpportunityCard`** — `withWebSafeShadows` wraps a *stylesheet*,
  not a single entry; restructured to the repo pattern.
- **Story viewers** — passed `originParts`/`destinationParts` objects to a
  component whose props take raw strings.

---

### 5. Test infrastructure

- **`__mocks__/@sentry/react-native.js` (new)** — the real SDK ships
  untranspiled ESM, so any test transitively importing `lib/crashReporter.ts`
  died with `Unexpected token 'export'` when run in isolation.
- **`jest.config.js`** — maps that mock; adds `moti`, `react-native-reanimated`,
  `lottie-react-native`, `@motify` to `transformIgnorePatterns` (same ESM issue,
  hit by any test rendering a screen that imports them).
- **`eslint.config.cjs`** — `@typescript-eslint/no-require-imports` off for test
  files. Jest hoists `jest.mock()` factories above the import block, so
  `require()` inside one is the documented pattern, not a lapse.

#### Tests updated to match current behaviour
Four assertions encoded superseded designs and were failing because the code had
moved on, not because it was wrong:
- `quoted` status moved from the Quoted tab to Open (migration `20270128103100`)
- Sponsored story posts sort **first** (monetization ordering)
- Indent surfaces re-parented to `tripops.tab` (prevents a Trip Ops member
  unlocking the whole Network tab)
- Sign-in footer link now routes to the onboarding hub, not the suite sign-up href

Stale mocks were also repaired where production had added a DB call or a
recovery branch the test didn't queue a response for.

**Open item:** `tripops.pulse_loads` still parents to `sales.tab` while its
eight sibling indent surfaces parent to `tripops.tab`. Confirmed intentional
(it's the loads-hub landing screen inside the Network tab) — the catalog
integrity test carries a documented exemption rather than papering over it.

---

### 6. Lint: 139 → 95 errors

Auto-fixable unused imports removed; 13 unused function args prefixed with `_`
(destructured props written as `name: _name` so the property lookup survives);
one genuinely dead local removed.

**Stopped here by decision.** The remaining 95 are judgment calls, not breakage:
- **44 `pulse/file-naming`** — cosmetic renames (`*.util.ts` / `*.service.ts`
  suffixes) touching 34 import sites. Wide diff, high conflict risk.
- **30 unused vars** — whole dead functions/components in product files
  (`TableStatusCell`, `renderDesktopStatusTabs`, `publishDispatchEvents`).
  Each has exactly one reference: its own declaration. Some may be unfinished
  work rather than abandoned, so deleting them is a product call.
- **21 `@typescript-eslint/no-explicit-any`** — mostly Edge Functions. Needs a
  real type per call site; a wrong type is worse than `any` because it reads as
  a guarantee.

---

### 7. Docs

- `docs/DB_LOAD_ARCHITECTURE_REVIEW.md` (new) — the architecture review,
  coverage audit, rollout plan and smoke-test results.
- `docs/RBAC_OPERATING_MODEL_CHANGELOG.md` — entry for the `trip_compliance`
  capability-leak fix, as the repo's RBAC process requires.

---

### Verification

All numbers above were measured, and the "before" figures were confirmed by
re-running each gate with these changes stashed.

Two caveats worth carrying forward:
1. One full-suite run reported a failure that turned out to be a Jest worker
   `SIGSEGV` under memory pressure, not a regression — a re-run with
   `--maxWorkers=2` passed cleanly. The suite can flake this way under load.
2. The per-screen request counts in the architecture review come from static
   analysis, not runtime traces. Phase 2 (observe-only) should confirm the real
   profile before the concurrency ceiling is tuned to specific numbers.
