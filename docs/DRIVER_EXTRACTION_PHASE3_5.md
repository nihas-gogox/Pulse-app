# Driver Extraction — Phase 3.5 Validation

Date: 2026-09-24 · Branch: `nihas/driver-app-extraction` · Code under test: `6fba0010`, plus the F1 fix `ec059575`.
**Validation only**, except the approved F1 fix (below), which was applied as its own commit.

## Final status: Phase 3.5 CLOSED (approved 2026-09-24)

Accepted code: `ec059575`. The local validation gate **passed**. The items below that need real accounts or a native build are **BLOCKED**, not failed.

### Final gate matrix
| Area | Result |
|---|---|
| Driver web routes: 46 URLs, direct load and hard refresh, under `/driver` | ✅ PASS |
| Base path and in-app navigation (D22) | ✅ PASS |
| Route matching (`trip/[tripId]`, `trip/[id]/…`, `(modals)`) | ✅ PASS |
| `/terminal-website` hand-off | ✅ PASS |
| Driver/non-driver gate: decision logic (unit tests) | ✅ PASS |
| Session: no session → sign-in | ✅ PASS |
| Onboarding entry (`/onboarding` → sign-up) | ✅ PASS |
| Main-app rollback, signed out (14 URLs vs the Phase 2 build) | ✅ PASS |
| No main-app code in the driver bundle (web, Android, iOS) | ✅ PASS (after F1) |
| Import boundaries (`check:driver-boundaries`) | ✅ PASS |
| Driver typecheck / tests / web build | ✅ PASS (3 baseline type errors / 203 tests / builds) |
| Driver Android and iOS JS bundles; native config | ✅ PASS |
| Main typecheck, tests, lint, nav-policy, cycles, web build | ✅ PASS (all baseline-equivalent) |
| `oms` typecheck and build | ✅ PASS |
| Backend (`supabase/` since V1) | ✅ PASS: 0 files changed |
| Driver/non-driver gate with real accounts | ⛔ BLOCKED |
| Signed-in session restore | ⛔ BLOCKED |
| Completed signed-in driver flows | ⛔ BLOCKED |
| Native deep links and on-device checks | ⛔ BLOCKED |
| Push | out of scope |

### Blocked validations (carried to preprod; nothing assumed or simulated)
| Blocked item | What it covers | Needs |
|---|---|---|
| **Driver / non-driver real-account validation** | A driver lands on the dashboard; a non-driver sees the rejection screen ("Go to Pulse", "Sign out") | one driver and one non-driver test account |
| **Signed-in session restore** | Main-app login then `/driver`; opening `/driver` with an existing session; token refresh | test accounts and a preprod `/driver` URL |
| **Completed signed-in driver flows** | Dashboard, trip control and detail, chat; fuel/toll/other entry, verification, expense capture; wallet, passbook, salary request, pending earnings; available loads and bids, my fleet, commerce mission, documents; OTP sign-up completion; signed-in rollback in the main app | test accounts (and a real phone for OTP) |
| **Native deep links / on-device** | `pulsedriver://…`, the `pulse://driver-invite` hand-off (fresh install / installed / running), auth, camera, background location on iOS and Android, EAS preview build | an EAS project and account owner for `com.gogopulse.driver` |
| Push (out of scope) | Push registration and delivery | the backend token-keying decision (Phase 0) |

### Intentional deviations from V1 (approved; details below)
1. **48 temporary main → `apps/driver` rollback shims.** These are the 44 old route files plus 4 dead-code importers. They keep the old in-app driver flow as the rollback path. They are the only main → `apps/driver` edges the checker allows, and they are removed in 4C/6.
2. **One-hunk `expo-router` patch (D22).** In `patches/expo-router+6.0.23.patch`, `stripBaseUrl` now strips the base only as a whole segment. It's a no-op without a base URL. Regression test: `apps/driver/lib/__tests__/expoRouterBaseUrl.test.ts`.
3. **Expense-exit destination.** `/trip/:id?tab=expenses` opens the driver's own trip detail in `apps/driver`, and the main trip detail in the old in-app flow.

### New CI check: driver bundle sources
- **Command:** `npm run check:driver-bundle`. It builds the Pulse Driver web bundle with source maps, then `scripts/driver-extraction-bundle-sources.mjs` fails if any source file is main-app code.
- **Allowed:** `apps/driver`, `packages/{core,domain,ui,features}`, `node_modules`, `polyfills/`, Metro virtual modules, and the resources `assets/` and `locales/`.
- **CI:** job `driver-bundle-sources` in `.github/workflows/architecture-check.yml` (`npm ci`, then the check).
- It catches edges the import-graph checker can't see (finding F1).
- **Status:** passes locally (0 main-app code); **not yet run on GitHub Actions.**

### No Phase 4 changes (verified at `ec059575`)
| Check | Result |
|---|---|
| `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` referenced in code | 0 |
| `netlify.toml`, `scripts/build-ci.js`, `public/_redirects`, `netlify/` changed since V1 | 0 files |
| `app/index.tsx`, `app/_layout.tsx` changed since V1 | 0 files |
| `app/fleet-driver/` exists | no |
| Old `app/driver/[id]` route | still present |
| `DRIVER_ROOT` in the routes table | still present |
| Old driver routes and shims | all 48 present, unchanged |
| `supabase/` changed since V1 | 0 files |

---

Result key:
- **PASS:** verified here, with evidence.
- **FAIL:** verified broken.
- **BLOCKED:** needs something we don't have. Not assumed and not simulated.

## Result matrix

| # | Area | Check | Result | Evidence |
|---|---|---|---|---|
| 1 | Driver web routes | 45 URLs direct-loaded (= hard refresh) on the production `/driver` export, served like Netlify (`/driver/*` → `/driver/index.html`). The list is all `(driver)` routes, the auth routes, the D20 routes, the legacy names and an unknown path | **PASS** | Signed out: private → `/driver/sign-in`; `/sign-in`, `/sign-up` stay; `/onboarding` → `/sign-up`; legacy names forward with query kept (`/driver-sign-in?ref=x` → `/sign-in?ref=x`); unknown path → sign-in. No error screens. 0 `/driver/*` asset 404s |
| 2 | Base path | HTML, JS chunks and assets under `/driver/`; in-app pushes keep the base (D22) | **PASS** | Every script `src` is `/driver/_expo/…`. D22: 6/6 regression tests, plus browser checks: onboarding → `/driver-signup` → `/sign-up`; clicking "Sign in" → `/driver-sign-in` → `/sign-in`; 0 mangled `/-…` paths |
| 3 | Route matching | `trip/[tripId]` next to `trip/[id]/…`; `(modals)/language-settings` | **PASS** | Router trace: `/trip/x` → `["trip","[tripId]"]`, `/trip/x/verification` → `["trip","[id]","verification"]`, fuel/toll/other likewise, `/language-settings` → `["(modals)","language-settings"]` |
| 4 | Hand-off | `/terminal-website` (sign-up shell link) | **PASS** | `/driver/terminal-website` → same-origin `/terminal-website` |
| 5 | Web deep-link/path behavior | Paths, params, query strings, legacy aliases | **PASS** | rows 1–4 |
| 6 | Native deep links | `pulsedriver://…`, `pulse://driver-invite` hand-off | **BLOCKED** | needs a native build (no EAS project/owner). Config only: `scheme: pulsedriver` resolves ✅ |
| 7 | Driver / non-driver gate (logic) | Decision table | **PASS** | 6 unit tests: driver in; non-driver rejected; splash while loading; signed out → sign-in; restoring → splash; public pages skip the role check |
| 8 | Driver / non-driver gate (real accounts) | A driver lands on the dashboard; a non-driver sees the rejection screen | **BLOCKED** | no test accounts (none in the repo; none created) |
| 9 | Session restore | Main login then `/driver`; existing session; no session | **PARTIAL** | No session → sign-in: **PASS** (row 1). With a session: **BLOCKED** (accounts). Static only: both apps use the same `@pulse/core` Supabase client (same origin, so same auth storage) |
| 10 | Trip flows | Dashboard, trip control, trip detail, chat | **BLOCKED** (runtime) | routes resolve (row 3); needs a signed-in driver |
| 11 | Expense flows | Fuel / toll / other entry, expense capture | **BLOCKED** (runtime) | routes resolve (row 3); needs a signed-in driver |
| 12 | Wallet / passbook | Wallet, passbook, salary request, pending earnings | **BLOCKED** (runtime) | routes resolve (row 1); needs a signed-in driver |
| 13 | Onboarding | `/onboarding` → sign-up | **PASS** (signed out) | row 2; the OTP / signup completion needs a real phone → **BLOCKED** |
| 14 | Main-app rollback | 14 old in-app driver and main URLs on the current main export vs the Phase 2 export | **PASS** | Identical 14/14 (e.g. `/driver-sign-in` renders driver sign-in; `/onboarding/driver` → `/driver-signup`; private routes → `/sign-in` → `/terminal-website`, the existing anonymous policy). Signed-in rollback: **BLOCKED** (accounts) |
| 15 | No dispatcher/main-app code in the driver bundle | Every source file in the web, Android and iOS exports (source maps) | **PASS** (after the F1 fix) | `npm run check:driver-bundle`: 0 main-app code files. The only non-package sources are `node_modules`, Metro virtual modules and the root resources `assets/` and `locales/` (data, see F2). Before the fix: 11 files (F1) |
| 16 | Import boundaries | `check:driver-boundaries` | **PASS** | 0 breaks. It now scans `design-system/`; a probe package → `@/design-system/colors` import is caught |
| 17 | Driver typecheck | `tsc -p apps/driver` | **PASS** | 3 errors, all baseline, in shared package files |
| 18 | Driver tests | `jest apps/driver` | **PASS** | 33 suites, 203 tests |
| 19 | Driver web build | production export | **PASS** | exit 0 |
| 20 | Mobile bundle sanity | `expo export -p android` and `-p ios` | **PASS** | both compile to Hermes bytecode (`.hbc`) |
| 21 | Native config | `expo config --type prebuild` | **PASS** | Pulse Driver · `pulse-driver` · `pulsedriver` · `com.gogopulse.driver` (iOS + Android) · background location · camera · 4 plugins load · `eas.projectId`: none |
| 22 | Native runtime | EAS preview APK/IPA; auth, camera, background location on a device | **BLOCKED** | no EAS project / account owner |
| 23 | Push | — | **OUT OF SCOPE** | Phase 0 token-keying blocker |
| 24 | Backend untouched | `git diff 149fba7d..HEAD -- supabase/` | **PASS** | 0 files (migrations, RLS, RPCs, triggers, Edge Functions) |
| 25 | Main-app gates | typecheck, tests, lint, nav-policy, cycles, web export | **PASS** | re-run after the F1 fix: same as baseline (see "Re-run after the F1 fix") |

## Findings

**F1: `design-system/` was main-app code inside the driver bundle (was FAIL, row 15). FIXED; see "F1 fix" below.**
- `design-system/` is 9 files of pure tokens: colors, spacing, radius, elevation, typography, layout, density, motion and an index. They import only React Native, `@/constants/Theme` and `@/lib/platformViewStyle.util`, both of which are core in the old-path shim form.
- 11 files that moved in D20/D21 import it at runtime: `components/operational/*` and `operationsEntryScreen.styles`. There were 0 such importers at Phase 3's first commit (`8bcc039a`).
- **It was missed** because the inventory excludes `design-system/` (and `locales/`, `assets/`) from scanning. So neither the boundary checker nor the D20/D21 classifier saw these edges. That's my gap in the D20/D21 gate.
- Impact: no functional or dispatcher impact. They're tokens, and the bundle works. It's a boundary violation: `apps/driver` must not reach main-app code or legacy shims.
- **Fix (approved and applied; see "F1 fix"):**
  - Classify the 9 files as SHARED_CORE (they're design constants, like `constants/Theme`) and move them to `@pulse/core` with shims where needed.
  - Add `design-system/` to the inventory scan.
  - Add this bundle-sources check to the Phase 3 gate.

**F2: `locales/*.json` are in the driver bundle**
- Translation data, required by `@pulse/core` `i18n`.
- It's data, not code, like `assets/`, so the check treats it as a shared resource.
- It's listed so the Phase 6 audit decides whether it moves into `@pulse/core`. Not a failure.

## F1 fix (approved, applied)
- Classified the 9 `design-system/*.ts` files as SHARED_CORE (decision F1) and moved them to `packages/core/design-system/` with `scripts/driver-extraction-move.mjs`. Their only imports are Theme, the style helper and React Native, which are now package-internal.
- **Shims kept only where required:** `colors`, `layout`, `radius`, `spacing` and `typography` (the main app imports them). `density`, `elevation`, `motion` and `index` have no main-app importer, so they have no shim.
- **11 package files repointed** from `@/design-system/*` to `@pulse/core/design-system/*` (30 specifiers). The change is path-only.
- **Inventory:** `design-system/` is no longer excluded from scanning, so `check:driver-boundaries` sees these edges.
- **New gate:** `npm run check:driver-bundle` builds the driver web bundle with source maps and fails on any main-app code. It is also a CI job, `driver-bundle-sources`, in `.github/workflows/architecture-check.yml`. That job is not yet run on GitHub.

**Bundle leak, before and after**

| Before (11 main-app code files) | After |
|---|---|
| `design-system/{colors,density,elevation,index,layout,motion,radius,spacing,typography}.ts`, `constants/Theme.ts` (shim), `lib/platformViewStyle.util.ts` (shim) | **0**, on web, Android and iOS |

**Remaining intentional shared-resource exceptions (data, not code):**
- `assets/`: images and fonts (129 on web).
- `locales/*.json`: 22 translation files. Left for the Phase 6 audit, as instructed.

## Intentional deviations from V1 (documented, approved)

1. **48 temporary main → `apps/driver` shims.**
   - These are the 44 old route files plus 4 known dead-code importers, so the old in-app driver flow stays as the rollback path. Row 14 shows it's unchanged.
   - Removed in 4C/6. The checker allows main → `apps/driver` only through them.
2. **One-hunk `expo-router` patch (D22).**
   - `stripBaseUrl` now strips the base only as a whole segment. It's a no-op without a base URL, so the main app is unaffected.
   - Regression test: `apps/driver/lib/__tests__/expoRouterBaseUrl.test.ts`.
3. **Expense-exit destination.**
   - Leaving fuel/toll/other entry goes to `ROUTES.tripDetail(id)` = `/trip/:id?tab=expenses`.
   - In `apps/driver` that's the driver's own trip detail (`trip/[tripId]`). In the old in-app flow it's the main trip detail.

## What unblocks the BLOCKED rows
- **Test accounts** (one driver, one non-driver) and a preprod `/driver` URL. That covers rows 8, 9, 10, 11, 12, 13 (completion) and 14 (signed in).
- **An EAS project and account owner for `com.gogopulse.driver`.** That covers rows 6 and 22.
- **Push:** stays out of scope until the backend token-keying decision (Phase 0).

## Re-run after the F1 fix (all local)
| Check | Result |
|---|---|
| Driver bundle source scan (web, Android, iOS) | ✅ 0 main-app code |
| `check:driver-boundaries` | ✅ 0 breaks (618 in packages, 273 in `apps/driver`, 48 shims) |
| Driver typecheck | ✅ 3 errors (baseline, shared package files) |
| Driver tests | ✅ 203/203 |
| Driver web build + route matrix | ✅ 46/46 URLs (including `/terminal-website`), 0 `/driver` asset 404s |
| Driver Android and iOS bundles | ✅ Hermes `.hbc` built |
| Main-app rollback | ✅ 14/14 URLs identical to the Phase 2 build |
| Main typecheck | ✅ same 26 errors |
| Main unit tests | ✅ same 5 failures in the same 2 suites; 2706 pass |
| Nav-policy | ✅ 64/64 |
| Lint | ✅ same findings (normalized) |
| Circular imports | ✅ 39, all inside V1's existing cycle clusters |
| Main web build | ✅ 145 assets (identical set), 66 chunks |
| `oms` typecheck / build | ✅ 0 errors / builds |
| `supabase/` since V1 | ✅ 0 files changed |

## Reproduce
```
cd apps/driver && NODE_ENV=production CI=1 npx expo export -p web --source-maps --output-dir /tmp/drv
node scripts/driver-extraction-bundle-sources.mjs /tmp/drv/_expo/static/js/web     # row 15 (or: npm run check:driver-bundle)
cd apps/driver && npx expo export -p android --output-dir /tmp/drv-android           # row 20
npx tsc --noEmit -p apps/driver/tsconfig.json && npx jest apps/driver                # rows 17–18
npm run check:driver-boundaries                                                       # row 16
git diff --name-only 149fba7d..HEAD -- supabase                                       # row 24
```
