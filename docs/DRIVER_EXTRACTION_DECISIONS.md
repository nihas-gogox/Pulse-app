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
