# Driver Extraction — Phase 4A: web hand-off behind a kill switch

Date: 2026-09-24 · Branch: `nihas/driver-app-extraction` · Approved decisions: route collision handled inside 4A; native hand-off on a separate flag, kept OFF.

## What changed
| Area | Change |
|---|---|
| Kill switch (web only) | `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` (`'true'` = on; unset = off, the production default). Read by main-app code and `scripts/build-ci.js` only. **`apps/driver` never reads it** (the driver bundle has 0 references). |
| Native flag | `EXPO_PUBLIC_DRIVER_APP_NATIVE_HANDOFF_ENABLED` is reserved and **not implemented**. `isDriverNativeHandoffEnabled()` always returns `false`, so native keeps the old in-app flow. |
| Hand-off rules | `features/drivers/utils/driverAppHandoff.util.ts` (main-only). Flag on and web: a signed-in **driver** anywhere in the main app, or anyone on an old driver entry page (`/driver-sign-in`, `/driver-signup`, `/onboarding/driver`), goes to the same page under `/driver` (query kept). Never from a path already under `/driver` (loop guard). |
| Wiring | `app/index.tsx` driver branch: hand-off instead of routing into `(driver)`. `app/_layout.tsx` `RootLayoutNav`: `useDriverWebHandoff()` (`features/drivers/hooks/useDriverWebHandoff.ts`). |
| Route collision | Dispatcher driver detail moved: `app/driver/{[id],[id]/analytics,[id]/profile,_layout,loading}` → `app/fleet-driver/…` (`git mv`). Internal links repointed: `ROUTES.driverDetail/driverProfile/driverAnalytics` and 11 hard-coded links in 8 main files. `registry/org.ts` policies use `/fleet-driver/:id…` (same grant, deny target and priority) plus `*-legacy` entries; route inventory updated. |
| Legacy `/driver/<uuid>` | **Flag off (prod):** `app/driver/[id]…` are one-line redirects to `/fleet-driver/[id]…`, params kept. **Flag on (preprod):** Netlify rules (below) 301 it to `/fleet-driver/<uuid>` before the driver app can load. |
| Preprod-only deployment | `scripts/build-ci.js`: **only when the flag is `true`**, it runs the `apps/driver` web export after the main export, copies it to `dist/driver`, writes `dist/_redirects` and appends to `dist/_headers`, from `scripts/driver-web-redirects.js`. Flag off: the build is unchanged (it logs "NOT included"). |
| Netlify rules | Generated from the `apps/driver/app` route tree (never hand-written). Netlify applies `_redirects` before `netlify.toml`. The order is: `/driver/_expo/static/*` → 404; `/driver` and every real driver route (`/driver/<seg>`, `/driver/<seg>/*`) → `/driver/index.html` 200; then `/driver/:id/analytics`, `/driver/:id/profile`, `/driver/:id` → **301 `/fleet-driver/…`**; then `/driver/*` → driver SPA. Driver `index.html` is no-cache; hashed chunks are immutable. |
| Kill-switch reliability fix | `metro.config.js`: the flag value is folded into `config.cacheVersion`. **Found:** Metro's transform cache does not key on `EXPO_PUBLIC_*` values. A flag-on export after a flag-off export shipped `false` (reproduced), and with Netlify's persistent Metro cache a flipped flag could ship the old value, breaking rollback. After the fix: off → `!1`, on → `!0` with no cache clear. |
| RBAC changelog | Entry for the pattern rename (`docs/RBAC_OPERATING_MODEL_CHANGELOG.md`). No capability or gate change. |

Not touched: the 48 rollback shims, `apps/driver` code, the `expo-router` patch, the expense-exit behavior, Supabase/RLS/RPCs/triggers, push, EAS, store config, the native hand-off, and 4B legacy URL work beyond this collision.

## Route-collision verification
**Flag on (preprod-like).** Main + driver + generated rules, served by a local Netlify emulator (files first, `_redirects`, then `netlify.toml`), clean storage, signed out:

| URL | Result |
|---|---|
| `/driver/<uuid>` (+ `?tab=ledger`) | **301 → `/fleet-driver/<uuid>`** (query kept), main app. **Never the driver app** |
| `/driver/<uuid>/analytics`, `/profile` | 301 → `/fleet-driver/<uuid>/analytics`, `/profile`, main app |
| `/fleet-driver/<uuid>` | main app (signed out → `/sign-in` → `/terminal-website`, the existing anonymous policy) |
| Driver app, 46 URLs | **46/46**: private → `/driver/sign-in`; public pages stay; legacy names forward; `/driver/terminal-website` hands off |
| `/driver-sign-in?ref=x`, `/driver-signup`, `/onboarding/driver` (main) | **hand off** → `/driver/sign-in?ref=x`, `/driver/sign-up` (Pulse Driver) |
| `/wallet`, `/sign-in`, `/` (main, anonymous) | unchanged |
| Missing `/driver/_expo/static/*.js` | 404 |

**Flag off (prod-like).** No `_redirects`, so the driver app is not deployed:

| Check | Result |
|---|---|
| 14 old in-app driver and main URLs vs the Phase 2 build | **14/14 identical** (rollback preserved) |
| `/driver`, `/driver/wallet` | served by the main app (no driver SPA) |
| Route match (trace build) | `/fleet-driver/<uuid>` → `["fleet-driver","[id]"]` (+ analytics/profile); `/driver/<uuid>` → the legacy redirect routes `["driver","[id]"]` |

**Unit tests (37 new):** `features/drivers/utils/__tests__/driverAppHandoff.util.test.ts` and `scripts/__tests__/driverWebRedirects.test.ts`. They cover:
- flag parsing, web-only, native off
- path mapping and the loop guard
- the root-segment list stays in sync with `apps/driver/app`
- every `apps/driver` route file → driver SPA
- `/driver/<uuid>` (+ subpaths) → 301 `/fleet-driver`
- `ROUTES.driver*` builders produce `/fleet-driver` URLs the rules never capture
- chunk 404, cache headers

## Phase 4A gate
| Check | Result |
|---|---|
| Main typecheck | ✅ same 26 errors as baseline |
| Driver typecheck | ✅ 3 (baseline) |
| Unit tests | ✅ same 5 failures in the same 2 suites; 2743 pass (+37) |
| Nav-policy (incl. registry coverage) | ✅ 64/64 |
| Lint | ✅ same findings (normalized); new files clean |
| `check:driver-boundaries` | ✅ 0 breaks |
| `check:driver-bundle` | ✅ 0 main-app code in the driver bundle |
| Circular imports | ✅ 39, all inside V1's clusters |
| Main web build (flag off) | ✅ 145 assets (identical set), 66 chunks |
| `oms` typecheck / build | ✅ / ✅ |
| `supabase/` since V1 | ✅ 0 files |

## Not verified here
- **Signed-in hand-off.** A real driver session going to `/driver`, and a signed-in dispatcher opening `/fleet-driver/<uuid>`: **BLOCKED** (no test accounts).
- **Real Netlify.** The rules were checked with a local emulator of Netlify's first-match `:param` / `*` semantics. They must be re-checked on the preprod deploy.
- **Full `npm run build:ci` with the flag on.** Not run locally, because it reinstalls `oms/` and `analytics/` and writes the repo `dist/`. Its steps were run individually: main export, driver export, copy, rules and headers. The script syntax is checked.
- **Test-browser anomaly.** During one run, the local test origin already held a Supabase preprod auth token and main-app state (`app:last_full_path: /wallet`) that my tests did not create. Source unknown. It was cleared without being used, and every result above is from clean storage. With that session present, main `/sign-in` hit "Attempted to navigate before mounting the Root Layout". I could not re-check that signed out, and whether it is pre-existing is **unknown**.
- **Found, not fixed.** The same Metro cache gap applies to every other `EXPO_PUBLIC_*` variable (pre-existing). Only the kill switch is keyed now.

## To enable on preprod (Nihas, after merge; not done here)
1. On the **GX Pulse** Netlify site only: Site settings → Environment variables → `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED = true`.
2. Redeploy. The build log must show `Pulse Driver web app included at /driver`.
3. Leave **gogopulse.com (prod)** without the variable: flag OFF.
4. **Rollback:** remove the variable (or set it to anything other than `true`) and redeploy. The driver SPA and rules disappear, the main app serves the old in-app flow, and `/driver/<uuid>` redirects in-app to `/fleet-driver/<uuid>`.
