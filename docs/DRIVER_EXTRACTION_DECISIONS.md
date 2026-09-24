# Driver Extraction — Phase 1 Decisions Needed

Date: 2026-09-24 · Branch: `nihas/driver-app-extraction`
Full per-file list: `docs/DRIVER_EXTRACTION_CLASSIFICATION.md`. Regenerate it with:
```
node scripts/driver-extraction-inventory.mjs --json && node scripts/driver-extraction-classify.mjs
```

**Status:** sorting only. **No production code has moved.** Phase 1 moves start only after Nihas approves the decisions below and REVIEW = 0.

## 1. What the sorting found

| Class | Files |
|---|---:|
| DRIVER_ONLY | 255 |
| SHARED_CORE | 78 |
| SHARED_DOMAIN | 171 |
| SHARED_UI | 48 |
| MAIN_ONLY (the driver imports **only types** from these files; the files stay, and their types go to `@pulse/domain` in Phase 2) | 367 |
| **REVIEW** | **281** |

**The 1,200-file figure was inflated.**
- **Type-only imports:** 367 of the 1,200 files are reached only through type imports, e.g. `DriverTripExpenseLogSection` → `features/finance/index.ts` → `FinanceScreen` → `CustomersTab`. At runtime the driver loads **832 files**.
- **Barrel imports:** about 620 of those would remain if the driver's imports of feature barrels (`features/trips/domain/index.ts`, `components/mobile-input/index.ts`, …) pointed straight at the files they use. That estimate is a lower bound.

## 2. Decisions (8 items, covering all 281 REVIEW files)

### D2 — `lib/platform` (36 files; also unblocks **134** knock-on files) ⭐ biggest
- **The facts:** the Supabase client itself (`lib/supabase.ts:22,46-49`) imports `lib/platform` (for `configurePlatformDb` and the request moderator). `oms` uses the same folder through the `@pulse-platform` alias (`oms/vite.config.ts:27`, `oms/tsconfig.app.json:25`).
- **Recommendation:**
  - `lib/platform/{moderator,scalability,db}` → **SHARED_CORE**. This is request moderation and DB wiring: infrastructure.
  - `lib/platform/{services,repositories,mappers,orchestration,events}` and `lib/platform-identity` → **SHARED_DOMAIN**.
  - Leave `lib/platform/index.ts` as the shim until Phase 6, so `oms` is not touched.
  - One path-only change is required: `lib/supabase.ts` must import `configurePlatformDb` from `lib/platform/db/platformDb` instead of the barrel. Otherwise core would pull in the domain services. Behavior stays the same.

### D1 — Shared business UI (92 files)
- **The facts:** these are files like `features/chat/components` (36), `features/trips/operations` (15), `features/auth/signup` (12) and `features/trips/verification` (12). Both apps render them. Under the contract they fit nowhere: domain can't hold presentation, and ui can't hold business logic.
- **Recommendation:** add a 4th package, **`@pulse/features`**, for shared business UI that may use core, domain and ui. **This changes the contract** (plan §1), so it needs your approval.
- **Alternatives:**
  - duplicate the code into the driver app: rejected, two copies
  - have the driver stop using these screens: rejected, that changes behavior
- `features/auth/signup` (12) arguably fits `@pulse/ui` already (the plan lists the signup shell and keypad there). **Recommendation:** SHARED_UI, if its runtime dependencies allow it.

### D3 — `OrganizationContext`, `ActiveWorkspaceContext` (2 files, unblock 3)
- **The facts:** the driver reaches them through shared chat, finance, ratings and trip-detail code, and through `lib/useCapabilities` and `lib/useMemberAccess`.
- **Recommendation:** **SHARED_CORE**, with a **DRIVER_ADAPTER** provider in the driver app that supplies the driver's own org/membership. Don't change the context logic.

### D4 — Driver files that the live main app imports (6 files)

| File | Main-app importers | Recommendation |
|---|---|---|
| `features/driver/services/driverLocation.service.ts` | trip detail, track & trace | SHARED_DOMAIN |
| `features/driver/job-card/deliveryProof.ts` | tripCompliance (3) | SHARED_DOMAIN |
| `features/driver/tripHistory/tripHistoryDetail.util.ts` | `TripDetailScreen` | SHARED_DOMAIN |
| `contexts/DriverThemeContext.tsx` | trips/operations/shared (3) | SHARED_UI (theme) |
| `contexts/DriverAvatarContext.tsx` | `lib/avatarUpload.ts` | SHARED_CORE, next to `avatarUpload` |
| `features/driver/components/RazorpayTestPreviewSheet.tsx` | `network/OrgMyBidsList` | `@pulse/features` (D1) |

### D5 — `LeafletMap.web.tsx` uses a trips util at runtime (1 file)
- **Recommendation:** move `features/trips/utils/mapRouteViewport.util.ts` (pure viewport math) to SHARED_CORE maps.

### D8 — Map family knots (4 files)
- **The facts:** the shared `LeafletMap.*` use the driver's own `DriverMapAvatarMarker`, and `lib/maps/leafletNativeImplementation.ts` imports `LeafletMap.rnmaps.tsx`, which means core depends on a UI component.
- **Recommendation:**
  - `DriverMapAvatarMarker` → SHARED_UI, together with the map family.
  - `lib/maps/leafletNativeImplementation.ts` → SHARED_UI. It's a component loader, not infrastructure.

### D9 — Barrel imports (path-only change)
- **Recommendation:** allow Phase 1 to rewrite the driver code's imports of feature barrels (`index.ts`) to direct sub-paths.
- It's a path-only change with the same symbols and no behavior change. It matches the barrel ban that ESLint already enforces for `app/`, `components/` and `contexts/`.

### D10 — Contract clarification: type-only dependencies
- **Recommendation:** confirm that a file the driver imports **only types** from stays in place (MAIN_ONLY), and that only its types move to `@pulse/domain` in Phase 2.

## 3. After you decide
- I write each approved decision into `docs/DRIVER_EXTRACTION_OVERRIDES.json`, re-run both scripts, and confirm REVIEW = 0 with no contract violations.
- Only then does the first Phase 1 move start: the reverse-import fixes, the barrel rewrites if D9 is approved, and the ESLint boundary rules.

---

## Round 2 — after recording D1–D10 (2026-09-24)

**Recorded:** `docs/DRIVER_EXTRACTION_OVERRIDES.json`, where D1, D2, D3, D4, D5, D8, D9 and D10 are applied. The classifier now models the approved path-only rewrites: D2's `lib/supabase.ts` → `platformDb`, and D9's driver barrel imports → the files they really use.

| Gate | Result |
|---|---|
| REVIEW = 0 | ❌ **60** |
| Package-rule violations among classified files | ✅ 0 |
| Files the driver no longer loads once D2/D9 rewrites are done | 125 |

**Two rule fixes I made, both within the approved intent. Please confirm:**
1. D1 "shared business UI" now means files that **render UI** (JSX). Types and constants that happen to sit in a `components/` folder, e.g. `tripDocTypes.ts`, follow the normal domain rule.
2. The D1 signup pattern now applies only to signup files that render UI. `signUpConstants.ts` is plain constants, so it follows the normal rules.

**Checker fix:** the old checker could leave files stuck blocking each other in a loop even when all of them were allowed. It now settles every class upgrade first, then marks real rule breaks.

**All 60 remaining files trace back to 8 real rule breaks. They need these 5 new decisions:**

### D11 — `AuthContext` is domain today (it breaks approved D3)
- **The facts:** `contexts/AuthContext.tsx` imports at runtime `features/auth/services/auth.service`, the keep-signed-in hooks, `lib/driverPerfMetrics` and `lib/firstLaunch`. Those are domain code, so it can't be core yet.
- Approved D3 put `OrganizationContext` and `ActiveWorkspaceContext` in core, and both depend on `AuthContext`, so D3 breaks the package rules.
- **Recommendation:**
  - Classify `AuthContext` as **SHARED_DOMAIN** for Phase 1.
  - **Amend D3:** both contexts become SHARED_DOMAIN. The DRIVER_ADAPTER provider stays.
  - The plan's Phase 2 auth split (core session vs app gate) is what later moves the session part into core. No logic changes now.

### D12 — `lib/chatPerf.ts` is infrastructure
- **The facts:** these are client-side performance counters (timing only, no business logic). The approved-core `lib/platform/scalability/platformHealth.ts` imports them. The file was placed in domain only because its name contains "chat".
- **Recommendation:** SHARED_CORE.

### D13 — Avatar components need business data
- **The facts:** `components/Avatar.tsx` and `components/PartyAvatar.tsx` (ui) use `lib/avatarContext.ts` and `lib/partyAvatarDisplay.ts`. Those depend on `lib/avatarUpload.ts` → `AuthContext`, which is domain.
- The mobile-input components (`SmartInput`, `FullscreenNumericEntry`, `NumericEntryRecipientHero`) and chat avatar pieces render these avatars.
- **Recommendation:** `Avatar`, `PartyAvatar` and the components that render them → **SHARED_FEATURES**. They show party/business avatars. No logic change.

### D14 — `RoutePlanMapPin` goes with the map family (extends D8)
- **The facts:** the shared `LeafletMap.maplibre` and `LeafletMap.rnmaps` render `features/driver/job-card/parts/RoutePlanMapPin.tsx`, which is currently driver-only.
- **Recommendation:** SHARED_UI, together with the map family.

### D15 — Re-export shim goes with its target
- **The facts:** `features/trips/verification/components/VerificationStatusChip.tsx` is a one-line re-export of `../VerificationStatusChip` (features).
- **Recommendation:** SHARED_FEATURES.

---

## Round 3 — gate passed (2026-09-24)

D11–D15 and both rule tweaks are recorded in `docs/DRIVER_EXTRACTION_OVERRIDES.json`. Applied narrowly:
- D3 is amended to SHARED_DOMAIN.
- D13 moves only `Avatar`, `PartyAvatar` and the 3 UI files that render them: `mobile-input/SmartInput`, `FullscreenNumericEntry` and `NumericEntryRecipientHero`.

| Gate | Result |
|---|---|
| REVIEW = 0 | ✅ 0 |
| Package-rule violations = 0 (every shared file's runtime imports checked against core → domain → ui/features, including shared → driver-only/main-only edges) | ✅ 0 |
| Files the driver no longer loads once D2/D9 rewrites are done | 125 |

| Final class | Files |
|---|---:|
| DRIVER_ONLY → `apps/driver` | 249 |
| SHARED_CORE → `@pulse/core` | 86 |
| SHARED_DOMAIN → `@pulse/domain` | 275 |
| SHARED_UI → `@pulse/ui` | 45 |
| SHARED_FEATURES → `@pulse/features` | 64 |
| MAIN_ONLY (the driver uses types only; the files stay put) | 481 |

**Stopped here. No code has moved.** Next, only on Nihas's go: the Phase 1 code changes, i.e. the reverse-import fixes, the D2/D9 path-only rewrites and the ESLint boundary rules.

---

## Phase 1 code — result (2026-09-24)

**Changes (path-only, no behavior change):**
- **D2:** `lib/supabase.ts` now imports `configurePlatformDb` from `@/lib/platform/db/platformDb` instead of the `@/lib/platform` barrel.
- **D9:** `scripts/driver-extraction-rewrite-barrels.mjs` rewrote 14 barrel imports in 13 driver files. Each name now comes straight from the one file that defines it. Nothing was ambiguous and nothing was skipped.
- **Boundary enforcement:** `npm run check:driver-boundaries` (`scripts/check-driver-boundaries.mjs`) runs as a new job in `.github/workflows/architecture-check.yml`. It rebuilds the import graph and fails on:
  - main → driver-only runtime imports
  - driver → main-only runtime imports
  - shared-package direction breaks
  - files that enter the driver graph without a classification

  I checked it with a throwaway probe file, and it catches a main → driver import.
- **Why a script, not ESLint:** the installed `eslint-plugin-boundaries` is v6, where type-import handling moved to a new selector syntax. A 1,100-file ESLint list would also be fragile. The script uses the same graph and classification as the approved sorting, and it treats type-only imports as allowed (D10).
- **Reverse imports:** every live main → driver-folder import now points at a file approved as shared (D4, D8, D14). They're allowed under the boundary check, and the files physically move into the packages in Phase 2, so nothing moves twice.

**Checks against the V1 baseline:**

| Check | Result |
|---|---|
| typecheck | same 26 errors as baseline, 0 new |
| lint | identical findings to baseline, 0 new |
| unit tests | same 5 failures in the same 2 suites, 0 new |
| navigation-policy | 64/64 pass |
| `check:driver-boundaries` | ✅ 0 breaks |
| Re-classification on the new code | REVIEW = 0, 0 rule violations. The only change: 88 type-only files dropped out of the driver graph |

### D16 — Dead code that imports driver-only files (decision needed before Phase 2)
These files are imported by nothing, so neither app loads them. They would fail typechecking once Phase 2 moves the driver files:
- `components/OptimalRouteMap.tsx` (also referenced by `components/OptimalRouteMap.web.tsx`) → `lib/reactNativeMapsCompat.*`, `lib/mapStyles.ts`
- `features/chat/components/PingProgressBar.tsx` and `features/chat/utils/longHaulPingCount.util.ts` → `features/driver/utils/long_haul_heartbeat.util.ts`

**Recommendation:** classify them as **DELETE** and remove them in a separate small PR, with your OK. The checker reports them as warnings until then.

✅ **Approved and done (2026-09-24):** the 3 files are deleted. `components/OptimalRouteMap.web.tsx` (the unused web twin) is kept: it imports no driver-only code and wasn't part of D16. Driver-self screens move once, in Phase 3 (approved).

**Still in Phase 1 scope, deliberately deferred:** the driver-self screens in `features/drivers/screens` are DRIVER_ONLY, but moving them to `features/driver/screens` now and again into `apps/driver` in Phase 3 would move them twice. **Recommendation:** move them once, in Phase 3.

---

## Phase 2 — result (2026-09-24)

**All 470 approved shared files have moved**, each with `git mv` to `packages/<pkg>/<same path>`:

| Package | Files | Commit |
|---|---:|---|
| `@pulse/core` | 86 | `f7224594` |
| `@pulse/domain` | 275 | `59699a41` |
| `@pulse/ui` | 45 | `2a849868` |
| `@pulse/features` | 64 | `2a849868` |

**How the move works:**
- Every old path keeps a one-line re-export **shim** (a relative path, so Metro, Vite/oms, TypeScript and Jest need no config). All 470 shims are removed in Phase 6.
- Mover: `scripts/driver-extraction-move.mjs`. It keeps the manifest `packages/extraction-moves.json`.

**Wiring:**
- `tsconfig.json`: paths for `@pulse/*`.
- `jest.config.js`: old `@/…` paths map straight to the moved files, so the 185 existing `jest.mock('@/…')` calls still mock the same module instance.
- npm workspace links for the 4 packages. The lockfile only gains workspace links (plus the existing `packages/pulse-v2`, which the old lockfile was missing).
- The ESLint map-loader `require()` exception now also covers `packages/*/lib/maps`.
- `check:driver-boundaries` now scans the packages. It also fails on package → app runtime imports and on files sitting in the wrong package.

**Tests adjusted (path-only):**
- 5 tests had relative `jest.mock` paths; these are now `@/…`.
- 3 contract tests read source files as text; they now point at the moved files. One of them (`execution-plan-graph-claim`) had been passing while reading the shim. A probe now confirms **no test reads a shim**.

**Checks against the V1 baseline, run after every package:**

| Check | Result |
|---|---|
| typecheck | same 26 errors (paths normalized) |
| unit tests | same 5 failures in the same 2 suites |
| navigation-policy | 64/64 |
| lint | same findings. Pre-existing file-naming findings now show on both the shim and the moved file (same name, same finding) |
| `oms` typecheck | 0 errors (baseline 0) |
| `oms` Vite build | ✅ |
| Metro web export | ✅ 145 assets (identical set), 66 chunks, +92 KB (the shims) |
| clean checkout + `npm ci` | ✅ links resolve. typecheck output is **identical to a clean checkout of V1** (52 errors in both; see below) |

### Found, not fixed
- **`expo-asset` is used but not declared.** `constants/presetAvatar.ts` imports it, but it isn't in `package.json`; only a copy nested under `expo` is in the lockfile.
  - On Nihas's machine it existed as an extra, undeclared install. `npm install` pruned it, and I restored it locally with `--no-save`.
  - In a clean install (and so in CI's `npm ci`) typecheck has **52** errors, not 26; the other 26 are web-style typings from locally installed extras. That is identical on V1, so it's pre-existing.
- **New dead-code warning:** `lib/tracking/useTrackingAppState.ts` (imported by nothing) → driver-only `lib/safeForegroundPositionWatch.ts`. It surfaced once the checker scanned the full graph. Proposal: D17 below.
- **Git history:** each old path now holds a shim, so git sees "file modified + new file" rather than a rename. Full history is still one command away: `git log --follow -C -- packages/<pkg>/<path>` or `git log -- <old path>`.

### Decisions needed to close Phase 2

**D17 — delete `lib/tracking/useTrackingAppState.ts`** (dead code, same case as D16).
- **Recommendation:** delete it.

**D18 — Auth split: accept the current split, no `AuthContext` refactor.**
- **The facts:**
  - The session engine (`lib/authEngine.ts`: session state, `AuthError`, `AuthStatus`, `UserProfile`) already sits in **`@pulse/core`**.
  - `AuthProvider` (`contexts/AuthContext.tsx`, 898 lines, 173 importers) is in `@pulse/domain`, per D11, because it uses auth services.
  - The "who may enter this app" gates live in app routing (`app/index.tsx`, `app/_layout.tsx`), not in `AuthContext`.
- **Recommendation:** the plan's "core = who is logged in / app = who may enter" split is already achieved without touching the fragile `AuthContext`. The driver app gets its own gate in Phase 3. No auth code change in Phase 2.

**D19 — Type-only references from packages to app files (D10 follow-up).**
- **The facts:** there are 117 type-only imports, into **35** app files (13 in `lib/`, and the rest across `features/finance`, chat, ratings, clients, trips, …). They're erased at runtime and allowed by the checker.
- **Recommendation:**
  - Files that hold only types (e.g. `lib/platform/types/*`, `features/finance/aggregation/types.ts`) move whole into `@pulse/domain`, with a shim.
  - For mixed files, the type declarations move into a `*.types.ts` file in `@pulse/domain`, and the original file re-exports them.
  - Do this as its own small step, still inside Phase 2, before Phase 3. This needs your approval.

---

## Phase 2 gate — after D17–D19 (2026-09-24)

**D17 (on hold, nothing deleted):** `lib/tracking/useTrackingAppState.ts` is **not** zero-import. `lib/tracking/index.ts` re-exports it on line 2. That barrel is itself imported by nothing, but deleting the file would mean editing the barrel too, which is beyond what was approved. My earlier "imported by nothing" was wrong: the checker only said neither app reaches it. Decision needed: delete the file and its barrel line, or keep both.

**D18:** accepted. No `AuthContext` change.

**D19 (done):** `scripts/driver-extraction-d19-types.mjs` uses the TypeScript compiler API.
- **17 types-only files** moved whole into `@pulse/domain`, each with a shim marked "D19 types".
- **13 mixed files:** only the needed type declarations (plus the local types they depend on) moved into `packages/domain/**/*.types.ts`. Files from `services/` and `utils/` go into a sibling `types/` folder, because of the file-naming rule. The original files import back only the types they still use and re-export the ones they exported before, so their public surface is unchanged.
- **3 barrels** (`features/finance/index.ts`, `features/ratings/index.ts`, `lib/suite/suiteProducts.ts`) stay put; their package consumers now point at the real source file.
- **2 stale imports** (auth.service and ChatSlackMobileChrome types, reached via shims) now use package paths.
- **120 package imports repointed** in total.
- **Proof that no logic moved:** all 30 D19 files in `@pulse/domain` compile to **zero JavaScript**.
- **1 skipped:** `InvoicePodPolicy` (`features/invoicing/utils/invoicePodPolicy.util.ts`) is built with `typeof` from a runtime array, so moving it would move logic. It stays as the **only** package → app import, and it's type-only, which D10 and the checker allow.
- **First attempt failed the gate** (a syntax error from misplaced re-imports, unused type imports, and file-naming). I reverted it completely and fixed the script, and the second run passed.

**Phase 2 gate:**

| Check | Result |
|---|---|
| Files in packages | 500 (470 shared + 17 D19 moves + 13 D19 type files) |
| Package → app imports | 1 (type-only, `InvoicePodPolicy`; approved skip) |
| `check:driver-boundaries` | ✅ 0 breaks |
| typecheck | ✅ same 26 errors as baseline |
| unit tests | ✅ same 5 failures in the same 2 suites |
| navigation-policy | ✅ 64/64 |
| lint | ✅ same findings as baseline (deduped) |
| `oms` typecheck / Vite build | ✅ 0 errors / builds |
| Metro web export | ✅ 145 assets, 66 chunks |
| tests reading shims | ✅ 0 |
| clean `npm ci` | ✅ (done at 2c, identical to clean V1) |

Not fixed, per instruction: the 52 clean-install baseline errors (undeclared `expo-asset`, and local-only typings).

**Phase 3 not started.** It waits for explicit approval.

## Phase 2 complete — D17 done (2026-09-24)
- **D17:** deleted `lib/tracking/useTrackingAppState.ts` and its re-export line in `lib/tracking/index.ts`, after verifying there were zero imports of the file and zero uses of `useTrackingAppState` anywhere, and that nothing imports the `lib/tracking` barrel.
- **Final Phase 2 gate:** baseline-equivalent on every check. One unit run hit a Jest worker SIGSEGV crash in `unifiedCreateFlow.test.ts`; re-run alone it passes 18/18, and the full re-run matches the baseline exactly.
- **Remaining checker warnings** (dead code, not failures, already present before D17):
  - `features/drivers/components/DriverMapView.tsx`
  - `features/tracking/index.ts` (3 re-exports of driver-only tracking files)
- **Phase 3 not started.**

---

## Phase 3 — `apps/driver` created, gate partly blocked (2026-09-24)

**Done (path-only for moved code, no behavior change):**
- **Move:** all 249 DRIVER_ONLY files, plus 1 `.d.ts` and the 30 tests next to them, moved once into `apps/driver/<same path>` (`scripts/driver-extraction-app-move.mjs`; manifest `apps/driver/extraction-moves.json`).
  - The root-level driver routes took their contract URLs: `/sign-in`, `/sign-up`, `/onboarding`, `/trip/[tripId]`.
  - The `(driver)` group keeps its name, because the screens hard-code `/(driver)/…` hrefs in 60+ places.
- **Old flow kept as the rollback path:** the 44 old route files in `app/` are now one-line shims to `apps/driver`. The 4 known dead-code importers also keep shims. That's 48 shims, all marked "(driver extraction, Phase 3)".
- **Legacy names:** the unchanged screens still push the old names. `apps/driver` has 4 redirect routes that forward them to the contract URLs (`lib/routes.ts` `LEGACY_ROUTE_ALIASES`).
- **App shell:** `app.config.js` (Pulse Driver, `pulse-driver`, `pulsedriver`, `com.gogopulse.driver`, root permissions/plugins, web `single` + `baseUrl: '/driver'`), `eas.json`, `metro.config.js` (watchFolders = repo root, root `node_modules`, the root's bundle-correctness resolver/polyfills), `babel.config.js`, `tsconfig.json`, `package.json`. Dependencies are 63 root packages at identical version specs.
- **Gate:** `lib/driverAppGate.ts` + `components/DriverAppGate.tsx`.
  - No session: sign-in.
  - Signed-in non-driver: `NotDriverScreen`, with a link to gogopulse.com and sign-out.
  - Driver: the app.
  - The rule is the existing `profile.role === 'driver'`; no new authorization.
- **Navigation-policy registry:** `lib/navigationPolicy/registry.ts`. A test enforces that every route has a policy.
- **Separate persisted-cache key** (`pulse-driver-cache-v1`), because both apps share the gogopulse.com origin.
- **Wiring:**
  - root workspaces += `apps/*`
  - root tsconfig excludes `apps/**`, so the driver's typed routes don't leak into it
  - `jest.config.js` maps old `@/…` driver paths to the moved files
  - the ESLint map-loader exception now also covers `apps/driver/lib/maps`
  - the lockfile gains only the workspace link and `dev` flag metadata; no version changed
- **Boundary checker, new rules:**
  - `apps/driver` → any main-app path is a break, including type-only imports and legacy shims.
  - main → `apps/driver` is a break unless it goes through a Phase 3 shim.
  - Both directions were verified with probes.

**Deviation to approve:** the rule "main app has 0 imports from `apps/driver`" holds except for the 48 shims above. They exist only because the old in-app flow must keep working until 4C. They are removed in 4C and 6.

### Blockers — decisions needed before the Phase 3 gate can close
**D20 — Main-app routes the driver navigates to by URL (not by import).**
- The driver pushes to:
  - `/trip/:id/verification`
  - `/trip/:id/operations/{fuel,toll,other,expenses,launcher}`
  - `/(modals)/language-settings`
- Their closure is **103 files** (81 never classified, 22 MAIN_ONLY). The Phase 0/1 inventory missed them because it only followed imports.
- Today in `apps/driver` these pushes hit not-found (→ dashboard).
- **Recommendation:**
  - Add the string-navigation targets as inventory roots, re-run the classifier, and approve the result (as in Phase 1).
  - Then add those route files to `apps/driver` under `trip/[tripId]/…`.

**D21 — Root app shell.**
- The main `app/_layout.tsx` mounts providers and hosts the driver relies on at runtime:
  - `AppAlertHost` / `ConfirmDialogHost`
  - error boundary
  - web RN compat patches (`installWebRnCompatPatches`, `htmlShell`)
  - background GPS task registration (`lib/tracking/backgroundTasks`)
  - `LazyChatProviders` (driver chat)
  - `GlobalSyncProvider`, `KeyboardAccessoryProvider`, `WalletProvider`, `PendingOnboardingProvider`
  - stale-deploy recovery, splash handling
  - cache buster
- None of these is classified. The driver-relevant subset pulls in **114 files** (88 unclassified, 26 MAIN_ONLY); chat providers alone are 73.
- `apps/driver/app/_layout.tsx` currently mounts **only already-shared providers**, so the app builds and routes but **is not at parity** (e.g. no alert host, no background location task).
- **Recommendation:** classify the subset listed in the `_layout.tsx` header (same process as D20), then mount it. The dispatcher-only pieces stay main-only: demo tab bar, overlay tab bar, preloads, KYC reminder, invite/referral gates, and push registration (push is blocked per Phase 0).

**D22 — expo-router base-URL bug (web, `/driver`).**
- `expo-router@6.0.24` `stripBaseUrl` (`build/fork/getStateFromPath-forks.js:183`) strips the base with a plain prefix regex, so in-app `/driver-signup` becomes `/-signup`.
- Every in-app push to `/driver-sign-in`, `/driver-signup` and `/driver-trip/:id` breaks on the web build. That's about 11 call sites plus `ROUTES.DRIVER_SIGN_IN`.
- Affected flows: sign-in ↔ sign-up links, onboarding, and opening trip detail from lists.
- Direct loads and hard refreshes work. The main app is unaffected (it has no base URL).
- **Options:**
  - (a) `patch-package` fix: a segment-boundary regex. A no-op without a base URL. The repo already uses patch-package.
  - (b) Point those call sites at non-`/driver`-prefixed names. That touches screens shared with the old flow, so it needs new main-app aliases too.
  - (c) Accept it until 4C, when the call sites switch to `DRIVER_ROUTES`.
- **Recommendation:** (a). Not applied: it modifies a dependency.

### Phase 3 checks vs V1 baseline
| Check | Result |
|---|---|
| `check:driver-boundaries` | ✅ 0 breaks. 264 files in `apps/driver`, 48 shims. Same 4 dead-code warnings |
| main typecheck | ✅ same 26 errors |
| `apps/driver` typecheck | ✅ 3 errors, all pre-existing baseline errors in shared package files; 0 in driver code |
| unit tests | ✅ same 5 failures in the same 2 suites. 2693 pass (+49 new). The 30 moved tests (32 suites) pass from `apps/driver` |
| navigation-policy | ✅ 64/64 |
| lint | ✅ same findings (normalized). The one new finding (map-loader `require`) is fixed by the ESLint exception |
| `oms` typecheck | ✅ 0 errors |
| main web export | ✅ 145 assets (identical set), 66 chunks, +4 KB |
| `apps/driver` web export (`/driver`) | ✅ HTML, JS and assets all under `/driver/`. No main-only screens in the bundle |
| `/driver`, `/driver/sign-in`, `/driver/sign-up` direct load | ✅ (served like Netlify: `/driver/*` → `/driver/index.html`) |
| hard refresh `/driver/wallet`, `/driver/trip/:id`, `/driver/passbook/history` with no session | ✅ redirect to `/driver/sign-in` |
| legacy direct loads (`/driver/driver-sign-in?ref=x` etc.) | ✅ forward, params kept |
| in-app navigation to legacy names | ❌ D22 |
| `npm ls -w @pulse/driver` | ✅ 63 deps, all resolved to the root copies, none invalid or missing |
| `supabase/` | ✅ untouched |

**Not done (outside Phase 3, or blocked):**
- Native build and EAS project: needs account owner (ambiguity #5).
- Push: Phase 0 blocker.
- Session restore with a real driver login: Phase 3.5.
- Store assets: the icon and splash still point at the root `assets/`.

**Found, not fixed:**
- `@react-navigation/bottom-tabs`, `@react-navigation/native-stack` and `expo-localization` are imported but undeclared (same case as `expo-asset`).
- NetInfo's web reachability probe issues `HEAD /`. That's fine at gogopulse.com, but needs checking in domain mode.

## Phase 3 — D20, D21, D22 done (2026-09-24)

Record: `docs/DRIVER_EXTRACTION_D20_D21.json`, produced by `scripts/driver-extraction-classify-d20-d21.mjs`.
- The pass is focused and additive, using the Phase 1 rules plus R1–R3.
- It is idempotent: a re-run gives 0 new files and 0 breaks.

### D20 — routes the driver reaches by URL
The sweep reads navigation targets through the TypeScript AST (comments ignored) and resolves `ROUTES.*` by evaluating the real `routes.ts`.

**Callers that count:**
- driver code
- code that newly enters the driver with a D20 route

Already-shared package code also serves the dispatcher. Its targets are reported and judged by hand, never auto-added.

**Added to `apps/driver`.** Each is a thin route that re-exports the shared body in `@pulse/features/app/...`; the main app keeps a shim at the old path.

| Route | Driver callers |
|---|---|
| `/trip/:id/verification` | DriverControlScreen, DriverTripOperationsTab, useDriverTripOpsActions |
| `/trip/:id/operations/fuel` | DriverControlScreen, and the other-expense screen's category switch |
| `/trip/:id/operations/toll` | DriverControlScreen, and the other-expense screen's category switch |
| `/trip/:id/operations/other` | DriverTripOpsContext, DriverHomeScreen, TripDetailSettlementPanel, useDriverTripOpsActions |
| `/(modals)/language-settings` | DriverHeader, DriverProfileScreen. Its own thin `(modals)/_layout` uses the main layout's screen options |

**Layouts:** not shared. The trip ops routes sit under the driver's existing `trip/_layout`. Its 5 driver providers are documented there as safe to wrap extra screens.

**Hand-off (nothing moved):** `/terminal-website`. The sign-up shell's "Pulse website" link opens the main app's page, same origin under `/driver`, else gogopulse.com. It is public in the gate.

**Not added:**

| Target | Reason |
|---|---|
| `/(tabs)/trips` | `tripExpenseEntryFallbackHref`, only when the trip id is empty |
| `/(tabs)/finance` | the `useSafeBack` default; every driver call passes its own fallback |
| `/auth/callback`, `/auth/reset-password` | email/OAuth redirects in `auth.service`; drivers use phone OTP |
| `/onboarding/business` | business signup |

**Behavior note:** the expense entry's normal exit, `ROUTES.tripDetail(id)` = `/trip/:id?tab=expenses`, lands on the driver's own trip detail in `apps/driver`. In the old in-app flow it lands on the main trip detail.

### D21 — root-shell pieces the driver relies on
**Shared and mounted in `apps/driver/app/_layout.tsx`:**
- `htmlShell`
- `installWebRnCompatPatches`
- `tracking/backgroundTasks` (module scope)
- `AppAlertHost` (5 driver callers of `appAlert`)
- `AppErrorBoundary`
- `ContentErrorState` and `webDeployRecovery`, used by the route `ErrorBoundary`: `components/DriverRouteErrorBoundary.tsx`, the same behavior as main but with driver sign-in
- `cacheBuster`
- `useColorScheme(.web)`

**Already-shared pieces, now wired:** `initCrashReporter`, `installForegroundPruning`, `installWebViewportHeight`, `installDriverInviteDeepLinkListener`, `hydrateSignupFlowFlags`. That last one is instead of `AppBootGate`.

**Kept main-only, 28 pieces, each with its reason in the JSON:**
- `GlobalSyncProvider`: explicitly off for `role=driver`
- `ConfirmDialogHost`: no driver caller
- `LazyChatProviders`: dispatcher chat; the driver has `DriverChatProvider`
- `GlobalOperationsToast`, `NavigationLoadingOverlay`, the tab bars and preloads
- the org KYC, invite and referral gates
- `AppBootGate` and `bootGate`
- `PushTokenRegistration`: push is blocked
- the Keyboard/Wallet/PendingOnboarding providers: no driver consumer

### Newly classified: 109 files, 0 breaks
| Class | Files |
|---|---:|
| SHARED_CORE | 15 |
| SHARED_DOMAIN | 44 |
| SHARED_UI | 18 |
| SHARED_FEATURES | 32 |

- 90 are new keys.
- 19 are MAIN_ONLY(Y1) files the driver now needs at runtime, e.g. `lib/capabilities.ts`, `components/operational/*` and `members.service`. They were type-only before.
- No other approved class changed.
- All 109 were moved with `scripts/driver-extraction-move.mjs`, with a shim at each old path.
- The two rule breaks the first pass hit were my own mistakes. My main-only list had blocked 2 real runtime dependencies (`useWebLayoutWidth`, `devConsoleFilters`). The list now only stops root seeding.
- **New rules:**
  - R1: a route body goes to a package, and each app keeps a thin route.
  - R2: a `components/` file needing domain/features → SHARED_FEATURES (the D13 outcome).
  - R3: a barrel takes the class of what it re-exports.

### D22 — expo-router base-URL fix
- `patches/expo-router+6.0.23.patch` gains one hunk, in `build/fork/getStateFromPath-forks.js` `stripBaseUrl`. The base is now stripped only as a whole segment: `(?=[\/?#]|$)`.
- No upgrade.
- The existing patch file (named for 6.0.23, applied to the installed 6.0.24, as before) was extended rather than renamed.
- It's a no-op without a base URL, so the main app is unaffected.
- **Regression test:** `apps/driver/lib/__tests__/expoRouterBaseUrl.test.ts`.
  - 6 tests against the real patched module.
  - Unpatched, 3 fail: `-sign-in`, `-signup`, `-trip/abc-123`.
- **Browser checks on the `/driver` build:**
  - `/driver/onboarding` → in-app `/driver-signup` → `/driver/sign-up`.
  - Clicking "Already activated? Sign in" → `/driver-sign-in` → `/driver/sign-in`.
  - 0 mangled `/-…` paths in the trace.

### Dependency findings (documented only, nothing changed)
| Package | V1 | How installed | Used by `apps/driver` |
|---|---|---|---|
| `@react-navigation/bottom-tabs` | undeclared (baseline) | transitive via expo-router (7.18.3) | type-only (`DriverTabBar`); erased at runtime → **not required** |
| `@react-navigation/native-stack` | undeclared (baseline) | transitive via expo-router (7.17.6) | type-only (`@pulse/core` `routeStackOptions`) → **not required** |
| `expo-localization` | undeclared (baseline) | **not installed** (not in lockfile) | guarded optional `require` in `@pulse/core` `i18n`; falls back to English, same as main → **not required** |
| `expo-asset` | undeclared (baseline) | lockfile has only `expo/node_modules/expo-asset`; the local top-level copy is the undeclared extra | **runtime-required**: `@pulse/core` `presetAvatar` (both apps). Whether a clean install resolves it at bundle time: **unknown** |
