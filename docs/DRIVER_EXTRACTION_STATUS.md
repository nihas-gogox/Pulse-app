# Driver Extraction — status after Phases 4C, 4D and preprod validation

Date: 2026-09-25 · Branch: `nihas/driver-4c` · Contract: `docs/DRIVER_EXTRACTION_PLAN.md`

**Where it stands:** the web extraction is done and passed preprod validation. Production (gogopulse.com) has not been deployed. The native Pulse Driver app is not release-ready.

## Commits
| Commit | What |
|---|---|
| `862d7223` | Extraction integrated onto Vasanth's prod V1 `7a471d15` (merge `fd2fb75d` + MarketLoadBidSheet moved to `@pulse/features`) |
| `411b445e` | **4C:** deleted 172 unused Phase 2 package shims |
| `87b107e1` | Refresh merge onto prod V1 `3832fe2e` (one conflict, `aggregateDrivers.ts`: shim kept, change applied to `packages/domain`) |
| `5788365d` | **4D:** web kill switch removed; hand-off permanent on web |
| this commit | Phase 6: docs + CI path triggers |

## Web architecture (permanent since 4D)
- **Main app** (`app/`, root Expo app) serves dispatcher/org/admin, including `/fleet-driver/<id>` (dispatcher driver detail).
- **Pulse Driver** (`apps/driver`) is exported by `scripts/build-ci.js` on **every** build to `dist/driver`, served at `/driver/*`.
- `scripts/driver-web-redirects.js` writes `dist/_redirects` (+ `_headers`), generated from the `apps/driver/app` route tree:
  - `/driver` and every real driver route → driver SPA (200);
  - `/driver/:id`, `/driver/:id/analytics`, `/driver/:id/profile` → **301** `/fleet-driver/…` (old dispatcher links);
  - `/driver/*` → driver SPA.
  Netlify applies `_redirects` before `netlify.toml`, so the main `/*` catch-all never takes `/driver`.
- **Hand-off (main app, web only):** `features/drivers/utils/driverAppHandoff.util.ts` + `useDriverWebHandoff` (`app/_layout.tsx`) + the driver branch in `app/index.tsx`. A signed-in driver anywhere in the main app, anyone on an old driver entry page, or a signed-out visitor on an old driver-only URL goes to the same page under `/driver` (query kept). Signed-in non-drivers are never handed off; shared routes (`chat`, `notifications`, `profile`, `trip`, `language-settings`) stay in the main app for them.
- There is no env flag. `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` is no longer read anywhere; leaving it set on a Netlify site is harmless.

## Native (unchanged, intentional)
- The main native app has **no hand-off** (`isDriverNativeHandoffEnabled()` returns `false`). Native drivers still use the old in-app driver flow.
- That flow is the **48 Phase 3 shims** (`// Moved to apps/driver/…`): `app/(driver)/*`, `app/driver-sign-in.tsx`, `app/driver-signup.tsx`, `app/onboarding/driver.tsx`, `app/driver-trip/*`, plus 4 tracking/map helpers. They re-export the `apps/driver` screens.
- **They can be removed only after all of:** Pulse Driver live in both stores; native hand-off implemented and enabled; `pulsedriver://auth/callback` in Supabase Auth (preprod, then prod); the push-token decision below implemented; device validation.
- `app/driver/[id]*` stay too (in-app legacy links → `/fleet-driver`).

## Rollback
The flag-OFF rollback no longer exists. Rollback = **republish the previous known-good deploy in Netlify** (gogopulse.com: Vasanth). Code rollback = revert the merge that brought `nihas/driver-4c` into V1.

## Validation evidence (`5788365d`, GX Pulse preprod, preprod Supabase)
| Check | Result |
|---|---|
| Server routing (`/driver/` = driver bundle; `/driver/<uuid>` 301 keeps query) | PASS |
| Signed out `/profile` (3/3, stays in main app) | PASS |
| Ravi (driver): sign-in, `/wallet`, `/control`, `/passbook/history`, `/salary-request`, `/my-fleet/add`, `/driver-trip/<id>`, `/chat`, `/profile` all land under `/driver/…`; deep-link reload; session restore; sign-out | PASS, 0 console errors |
| Suresh (dispatcher): old driver URLs stay in main app; `/fleet-driver/<id>`; `/driver/<id>?tab=ledger` → Cash Flow tab; `/driver` → "This app is for drivers" | PASS |
| `/find-loads` → Bid → shared MarketLoadBidSheet renders, keypad works (no bid submitted) | PASS |

Local gate at `5788365d` (same as `87b107e1`, i.e. no new failures): main TS 33 errors (= prod `3832fe2e`), driver TS 4, 6 test failures in 3 suites (logPods, mutualConnections, sign-in, = prod), hand-off 38/38, nav-policy 64/64, boundaries 0 breaks, lint 104 errors, madge 40 cycles, main + driver web builds pass, no main-app code in the driver bundle. These baselines are pre-existing and out of scope for the extraction.

## Observations (none caused by the extraction)
| Item | Status | Blocker? |
|---|---|---|
| O1: intermittent Root Layout error on driver sign-in | Also in V1 `149fba7d` | No |
| O5: Google sign-in returns via main `/auth/callback`, then hands off to `/driver` | Works | No |
| O6: marketing page flash before hand-off (signed out) | Cosmetic | No |
| Signed-out main `/sign-in` moves on to `/terminal-website` | Existing rule (`lib/navigationPolicy/evaluate.ts`), unchanged vs prod | No |
| `/control` without `?tripId=` shows "No active trip" | Same code as prod | No |
| `/settings` goes to OMS (`netlify.toml`), also for drivers | Existing | No |
| `[query] fetch failed {error:{}}` right after sign-in | All data requests 2xx; looks like cancelled queries | No |
| Preprod DB behind prod migrations (`list_marketplace_search_lanes`, `list_open_marketplace_loads_for_org` → 404; app falls back) | Environment drift | Check on prod release |
| `expo-asset` used but not declared in `package.json` | Pre-existing | No |
| `npm ci` fails on the lockfile (`@pulse/v2`); Netlify uses `npm install` | Pre-existing | No (CI jobs using `npm ci` affected) |

## Production handover (not approved yet)
1. Vasanth confirms the Netlify rollback procedure and the last known-good gogopulse.com deploy.
2. Check Vasanth's V1 HEAD right before integration. If it is still `3832fe2e`, V1 can fast-forward to this branch; otherwise a normal merge, then re-run the integration gate (watch shim-vs-package files like `aggregateDrivers.ts`).
3. Confirm gogopulse.com env (`EXPO_PUBLIC_SUPABASE_*`); the driver app picks Supabase keys in the same order as the main app.
4. Production deployment approval → Netlify publish → production smoke test (same checks as the table above).

## Native release track (separate)
- EAS project + owner (`apps/driver/app.config.js` has no `projectId`); Apple/Google accounts for `com.gogopulse.driver`.
- Supabase Auth redirect `pulsedriver://auth/callback`.
- **Push tokens (blocker, Phase 0):** `register_push_token` keys rows on `(user_id, token)` with no app column. Decide: (A) add app/project identity to token rows, or (B) send per Expo project. Not implemented.
- Native hand-off in the main app, preview build, device validation. Then the 48 shims can go.
