# Driver Extraction — Phase 3.5 Validation

Date: 2026-09-24 · Branch: `nihas/driver-app-extraction` · Code under test: `6fba0010`.
**Validation only: no app code was changed in this phase.**

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
| 15 | No dispatcher code in the driver bundle | Every source file in the export (source maps) | **FAIL** (11 files) | `scripts/driver-extraction-bundle-sources.mjs` on web and Android: all code is `apps/driver`, the packages or `node_modules`, **except** `design-system/*` (9 files) and the 2 old-path shims they import (`constants/Theme.ts`, `lib/platformViewStyle.util.ts`). No dispatcher screens. See Finding F1 |
| 16 | Import boundaries | `check:driver-boundaries` | **PASS**, with a known blind spot | 0 breaks; it does not scan `design-system/` (F1) |
| 17 | Driver typecheck | `tsc -p apps/driver` | **PASS** | 3 errors, all baseline, in shared package files |
| 18 | Driver tests | `jest apps/driver` | **PASS** | 33 suites, 203 tests |
| 19 | Driver web build | production export | **PASS** | exit 0 |
| 20 | Mobile bundle sanity | `expo export -p android` and `-p ios` | **PASS** | both compile to Hermes bytecode (`.hbc`) |
| 21 | Native config | `expo config --type prebuild` | **PASS** | Pulse Driver · `pulse-driver` · `pulsedriver` · `com.gogopulse.driver` (iOS + Android) · background location · camera · 4 plugins load · `eas.projectId`: none |
| 22 | Native runtime | EAS preview APK/IPA; auth, camera, background location on a device | **BLOCKED** | no EAS project / account owner |
| 23 | Push | — | **OUT OF SCOPE** | Phase 0 token-keying blocker |
| 24 | Backend untouched | `git diff 149fba7d..HEAD -- supabase/` | **PASS** | 0 files (migrations, RLS, RPCs, triggers, Edge Functions) |
| 25 | Main-app gates | typecheck, tests, lint, nav-policy, cycles, web export | **PASS** | unchanged since the Phase 3 gate (no code change in 3.5) |

## Findings

**F1: `design-system/` is main-app code inside the driver bundle (FAIL, row 15)**
- `design-system/` is 9 files of pure tokens: colors, spacing, radius, elevation, typography, layout, density, motion and an index. They import only React Native, `@/constants/Theme` and `@/lib/platformViewStyle.util`, both of which are core in the old-path shim form.
- 11 files that moved in D20/D21 import it at runtime: `components/operational/*` and `operationsEntryScreen.styles`. There were 0 such importers at Phase 3's first commit (`8bcc039a`).
- **It was missed** because the inventory excludes `design-system/` (and `locales/`, `assets/`) from scanning. So neither the boundary checker nor the D20/D21 classifier saw these edges. That's my gap in the D20/D21 gate.
- Impact: no functional or dispatcher impact. They're tokens, and the bundle works. It's a boundary violation: `apps/driver` must not reach main-app code or legacy shims.
- **Proposed fix, for approval; not applied in 3.5:**
  - Classify the 9 files as SHARED_CORE (they're design constants, like `constants/Theme`) and move them to `@pulse/core` with shims.
  - Add `design-system/` to the inventory scan.
  - Add this bundle-sources check to the Phase 3 gate.

**F2: `locales/*.json` are in the driver bundle**
- Translation data, required by `@pulse/core` `i18n`.
- It's data, not code, like `assets/`, so the check treats it as a shared resource.
- It's listed so the Phase 6 audit decides whether it moves into `@pulse/core`. Not a failure.

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

## Reproduce
```
cd apps/driver && NODE_ENV=production CI=1 npx expo export -p web --source-maps --output-dir /tmp/drv
node scripts/driver-extraction-bundle-sources.mjs /tmp/drv/_expo/static/js/web     # row 15
cd apps/driver && npx expo export -p android --output-dir /tmp/drv-android           # row 20
npx tsc --noEmit -p apps/driver/tsconfig.json && npx jest apps/driver                # rows 17–18
npm run check:driver-boundaries                                                       # row 16
git diff --name-only 149fba7d..HEAD -- supabase                                       # row 24
```
