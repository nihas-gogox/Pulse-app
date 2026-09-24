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
