# Driver App Extraction — Implementation Contract (v3)

Branch: `nihas/driver-app-extraction` (from V1 `149fba7d`)

## Context
The driver app lives inside the main Pulse Expo app as the `app/(driver)` route group. It is tangled with the main app in both directions: about 187 driver files, and about 30 main-app files that import driver code.

The goal is two apps that deploy independently from one repo, on top of a shared platform layer. It is an **application extraction, not a file move or a refactor**:
- **Web, now:** gogopulse.com/driver, with its own driver sign-in and sign-up pages. They reuse the auth infrastructure but are separate pages.
- **Web, later:** driver.gogopulse.com, as its own Netlify site.
- **Mobile:** its own native identity: "Pulse Driver", slug `pulse-driver`, scheme `pulsedriver`, `com.gogopulse.driver`, with its own EAS project, credentials, push setup and store listing.
- **Backend:** the same Supabase project and schema. Same DB does not mean the same authorization boundary: each app keeps its own gate.

## Non-negotiable extraction invariants
**Do not change any of these:**
- Supabase schema, migration files, RLS policies, RPCs, triggers.
- Edge Function behavior. The one exception is a CORS change that the new origin proves necessary.
- Existing business authorization semantics.
- Dispatcher/org-side driver functionality.
- Existing driver behavior or UI.
- Expo, React or dependency versions. No unrelated dependencies.

**Behavior preservation.** Moving code is not permission to change its behavior. The order is always: move, preserve behavior, verify, and clean up later.
- Exported function signatures don't change, unless a module or path move strictly requires it.
- Supabase RPC names and arguments don't change.
- Route semantics don't change, except the driver extraction and hand-off behavior documented here.
- For queries, none of these change: `staleTime`, retry, invalidation, pagination, or fetch strategy.
- No performance optimization, no unrelated database cleanup, no renaming unrelated APIs, and no behavior "clean-up" while moving code.

**Scope boundary.** The extraction must not also become a performance refactor, a database refactor, a query-optimization project, an RBAC redesign, a Supabase architecture redesign or a general code cleanup. Any such issue found along the way is written down separately and left unchanged.

**Scope discipline:**
- No business-logic redesign and no UI redesign.
- Unrelated tech debt found along the way is not fixed. It is recorded in the inventory under "found, not fixed".
- If something blocks the extraction, **stop and report**. Don't fix it opportunistically.

**Classification and safety:**
- Any file that can't be cleanly classified as `DRIVER_ONLY`, `MAIN_ONLY`, `SHARED_CORE`, `SHARED_DOMAIN`, `SHARED_UI`, `MAIN_ADAPTER`, `DRIVER_ADAPTER` or `DELETE` becomes `REVIEW`. Its migration step stops until it is resolved by hand.
- Every phase leaves the main app buildable and the previous phase revertible.
- Nothing is deleted until its replacement has passed preprod acceptance.
- **One code PR per phase**: 0, 1, 2, 3, 3.5, 4A, 4B, 4C, 4D and 6. Phase 5 is deployment stages, not code PRs. Never one giant PR.

## 1. Target architecture
```
app/                  Main Pulse (dispatcher/org). No driver-self routes. app/fleet-driver/[id].tsx
apps/driver/          @pulse/driver: independent Expo app
  app/(auth)/{sign-in,sign-up,onboarding}.tsx
  app/(tabs)/{index,wallet,passbook,trip-history,...}.tsx
  app/trip/[tripId].tsx
  features/ components/ contexts/ lib/
  app.config.js eas.json metro.config.js package.json tsconfig.json
packages/core/        @pulse/core
packages/domain/      @pulse/domain
packages/ui/          @pulse/ui
oms/, analytics/      untouched
```

**Workspaces:**
- The root `workspaces` becomes `["packages/*", "packages/platform/*", "apps/*"]`.
- `packages/platform/*` is an **existing workspace area, already in the root `package.json`, and outside this extraction**:
  - Its code is not moved or refactored.
  - `@pulse/core`, `@pulse/domain` and `@pulse/ui` add no dependencies to it.
  - Existing consumers of it stay unchanged.
  - Platform services are not pulled into `@pulse/core` unless that is approved later.
- Each new app and package gets its own `package.json` and `tsconfig.json`.
- Imports use the package names, e.g. `import { supabase } from '@pulse/core'`.

**Dependency rules (enforced in CI):**
- `core` may use third-party infrastructure libraries such as `@tanstack/react-query`. It must **never** depend on `@pulse/domain`, `@pulse/ui`, `apps/*`, `app/*` or any driver or business module. Its query keys are infrastructure primitives only; entity-specific keys belong in `@pulse/domain`.
- `domain` → `core`.
- `ui` → `core`, plus **type-only** imports from `domain` (`import type`, enforced by a lint rule). `ui` never imports domain runtime code: no services, hooks or business logic.
- The main app and `apps/driver` → `core`, `domain` and `ui`.
- Forbidden:
  - `packages/*` → `app/**` or `apps/**`
  - main app ↔ `apps/driver`, in either direction, including relative `../../app` paths, main-app `@/` aliases, and the legacy shims

**Package contents:**
- `@pulse/core`: the Supabase client, auth/session infrastructure, `queryClient`, generic query-key factory primitives (no business names), storage, media/avatar upload, maps infrastructure (`lib/maps/*`, including `*Implementation.ts`), formatters, validation primitives.
- `@pulse/domain`: UI-independent business logic and data access:
  - `services/`: trips, chat, auth signup, marketplace bids, reach, network, drivers
  - `queries/`: domain query keys, e.g. `queryKeys.trips.detail(id)`
  - `query-hooks/`: TanStack Query hooks
  - It may depend on React and React Query for hooks, but **contains no presentation components**.
- `@pulse/ui`: presentation only: LazySuspenseFallback, CenteredLoadingView, LoadingIndicator, the OTP boxes, the signup shell and keypad, the LeafletMap family.
- `apps/driver`: driver routes, screens, `Driver*` contexts, navigation policy, role gate, driver-only services and queries, push and deep links.
- Main app: dispatcher, operations, org/admin, driver management (add, list, view, assign).
- Code moves into a package only if it truly is core, domain or UI code, never just because both apps import it today. App-specific screen caches get app-specific query keys.

**Shims:** old paths are temporary re-exports (`export * from '@pulse/core/...'`). They are converted as each phase goes. No shim may point at another shim. All of them are deleted in Phase 6.

## 2. Routing contract
| Owner | Paths |
|---|---|
| Main Pulse | `/`, login, resources, operations, network, `/fleet-driver/[id]`, … |
| Pulse Driver (web) | `/driver`, `/driver/sign-in`, `/driver/sign-up`, `/driver/onboarding`, `/driver/wallet`, `/driver/passbook`, `/driver/trip/*`, … |
| Legacy | `/driver/<uuid>` → 301 `/fleet-driver/<uuid>`, **UUID pattern only**. The old driver browser URLs listed by Phase 0 map to their `/driver/*` equivalents. The `(driver)` group name never appears in URLs, so the actual old URLs are listed rather than assumed |

**Deep links:**
- The driver app owns `pulsedriver://*`. The main app owns `pulse://*`.
- An old `pulse://driver-invite?token=` link lands in the main app, which hands it off to Pulse Driver.

**When a driver logs into the main app:**
- Web: `window.location.replace('/driver')`.
- Native: a "Pulse Driver app required" screen that links to the App Store or Play Store. It never navigates to the web `/driver` route.

## 3. Phases

### Phase 0: Inventory, baseline, investigations
- Add `scripts/driver-extraction-inventory.mjs`. It builds the **transitive** import graph, reusing `madge`, which CI already uses, as the graph source. The graph covers:
  - every file under `app/(driver)`, `app/driver-sign-in`, `app/driver-signup`, `app/onboarding/driver`, `app/driver-trip`, `features/driver`, `components/driver` and `contexts/Driver*`
  - every direct importer of those files
  - everything reachable from that set
- The script writes `docs/DRIVER_EXTRACTION_INVENTORY.md`, which records:
  - direct and transitive dependencies
  - app-boundary violations
  - driver-only code
  - shared code
  - code that cannot be moved safely
  - a classification for every entry, from the invariants list
- It may include a one-level summary for people to read, but that summary is **never** the basis for calling the extraction safe.
- Document the `features/drivers` split:
  - **driver-self:** Home, Control, Chat, Available, Documents, LevelProgression, Notifications, Passbook, PendingEarnings, Profile, Requests, SalaryRequest(+Detail), Settings, TripHistory, Wallet
  - **driver management:** AddDriver, list, view, assign
  - **shared**
- List every legacy driver browser URL (from `lib/routes.ts` and the `app/(driver)` file tree).
- **Record the existing cycles** from `madge --circular` output, including the 5 known ones from `architecture-check.yml`. CI then asserts **no new cycles** and that the existing ones stay unchanged, unless one is resolved deliberately.
- Baseline, run from a **clean checkout + `npm install`**: `typecheck`, `npm test`, `test:navigation-policy`, `lint`, `madge`, `build:graph:strict`, `build:web`.
- Push-token investigation (read-only):
  - Question: are the rows stored by the `register_push_token` RPC (called from `features/notifications/services/pushToken.service.ts`) keyed by user only, or by user + device + app?
  - Status: **unknown today.**
  - If it's user-only: **stop the extraction** before any native push work and raise a separate backend design decision for approval. The extraction PRs never touch migrations, RLS or RPCs.
- Read-only CORS inventory: list the Edge Function allowlists and which functions the driver app calls.
  - `/driver` on gogopulse.com is the same origin, so there's likely no change now.
  - driver.gogopulse.com is a new origin and will probably need a change later.

### Phase 1: Untangle inside the current repo (no packages yet)
- Move **only** the `DRIVER_ONLY` and `DRIVER_ADAPTER` files into `features/driver/**`. `REVIEW` files don't move.
- Remove the reverse imports. Each piece moves wherever its classification says. Known ones:
  - `features/chat/*` (longHaulPingCount, PingProgressBar, DriverChatSlackThread)
  - `features/tripCompliance/*`
  - `features/network/OrgMyBidsList`
  - `features/drivers/hooks/useDriverLocation`
  - `components/driver/LeafletMap.*`
- Add ESLint `boundaries` rules at **error** level, in both directions.
- Gate: the baseline stays green, with no new cycles.

### Phase 2: Shared packages
- Create `@pulse/core`, `@pulse/domain` and `@pulse/ui`. Move the classified modules and leave temporary shims.
- **Auth split:**
  - `@pulse/core/auth` holds the session only: client, the multi-path restore (moved as-is, no logic change), state and token helpers. It answers "who is logged in".
  - Each app keeps its own provider and gate, which answers "can this user enter this app":
    - main app: org membership and staff/dispatcher permissions
    - driver app: the driver role and operating model
- Keep the root `lib/` 60-file cap satisfied. `lib/` only shrinks.
- Package verification:
  - every package has a `package.json` and `tsconfig.json`
  - every package resolves through the workspace from a clean `npm install`
  - the main app can import every package
  - no package imports `app/` or `apps/`

### Phase 3: Create `@pulse/driver`
- `app.config.js`:
  - native identity as described in Context
  - location, background-location and camera permissions, copied from the root config
  - maplibre, image-picker and build-properties plugins
  - web `output: 'single'` and `experiments.baseUrl: '/driver'`
- **`baseUrl` is not done until it's verified.** The router-generated links and the JS/static asset URLs must resolve under `/driver`, and `/driver`, `/driver/sign-in`, `/driver/wallet` and `/driver/trip/:id` must all survive direct navigation and a browser refresh.
- `metro.config.js`: `watchFolders` includes the repo root, and module resolution includes the root `node_modules`.
- Move the routes. Add `apps/driver/lib/routes.ts` and a driver-only navigation-policy registry, based on `lib/navigationPolicy/registry/driver.ts`.
- Auth pages under `(auth)` reuse `@pulse/ui` and `@pulse/domain`. A non-driver is rejected cleanly, with a link to gogopulse.com.
- Set up a separate EAS project. Push is wired only if Phase 0 cleared the token model.
- Run `npm ls` for a dependency audit. The driver app pulls in no main-app-only package.

### Phase 3.5: Validate the driver app (no main-app change)
- Run the full driver acceptance list on local and preprod, for both web and an EAS preview APK.

### Phase 4A: Hand-off from the main app, behind a kill switch
- Add the `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` flag. It applies to the **main app only**; `apps/driver` never reads it and always behaves as the new app.
  - `false`: the old in-app driver flow.
  - `true`: web redirects to `/driver`, native shows the install screen.
  - The flag is on in preprod and off in prod until validated.
- It's wired at `app/index.tsx` (around line 144) and the driver branches of `app/_layout.tsx` (around lines 535–610).
- Netlify: `scripts/build-ci.js` exports `apps/driver` to `dist/driver`, following the `dist/oms` pattern. `netlify.toml` gets `/driver/*` → `/driver/index.html` (status 200), placed before `/*`.

### Phase 4B: URL migration
- Add `app/fleet-driver/[id]` and switch the about 20 internal references to it, including `lib/routes.ts:237,268,285`.
- Add the UUID-only legacy 301 and the redirects for the listed old driver URLs.
- **Test the redirect order.** `/driver/sign-in` and `/driver/wallet` must stay in the driver SPA. Then remove the old `app/driver/[id]`.

### Phase 4C: Remove the old driver code
- This happens only after prod runs with the flag on.
- Delete `app/(driver)`, `app/driver-sign-in`, `app/driver-signup`, `app/onboarding/driver` and `app/driver-trip`, and their `Stack.Screen` entries.
- Remove `DRIVER_ROOT` and `DRIVER_SIGN_IN` from the main app's `lib/routes.ts`.
- Remove the driver policies from the main registry (`index.ts`, `routeInventory.ts`) and update the tests. Keep `ModelAccessGate` and `registry/org.ts` in sync.
- **The flag stays** through the whole observation and rollback period.

### Phase 4D: Remove the kill switch
- This happens only after the observation period confirms all of these:
  - prod web has been stable for the agreed period
  - driver auth and session restore are verified in prod
  - no driver regressions have been reported
  - rollback is no longer needed
- Then remove `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` and its old-flow branch. Never remove it early.

### Phase 5: Deploy and accept (deployment stages, not code PRs; no DB step)
- Stages: preprod web (GX Pulse) → preprod native (EAS preview) → preprod acceptance → prod web (through Vasanth sir) → prod native EAS promotion.
- **Prod web and prod native are gated independently.**
- Phase 5 runs alongside 4A–4D: prod web with the flag on starts the observation period for 4D.
- Supabase Auth redirect URLs:
  - Use only the patterns the current Supabase Auth settings support.
  - Verify the exact URLs on **preprod first**: the preprod `/driver` path and `pulsedriver://`.
  - Then add the prod equivalents through Vasanth sir.
- CORS changes only where the Phase 0 inventory showed they're needed. That is expected only for driver.gogopulse.com.
- Later, domain mode: a new Netlify site with base `apps/driver`, `baseUrl: ''`, and gogopulse.com `/driver/*` → 301 to driver.gogopulse.com.

### Phase 6: Enforcement, cleanup, docs
- Delete all the shims.
- CI (`.github/workflows/architecture-check.yml`) covers `apps/driver` and `packages/*`: lint/boundaries (including relative-path and legacy-shim bans), typecheck, jest, madge, build:graph. It also gets a **no-DB-change gate**: the extraction PRs must leave `supabase/migrations/` untouched.
- Docs:
  - `docs/GIT_WORKFLOW.md` changelog
  - `docs/RBAC_OPERATING_MODEL_CHANGELOG.md`
  - the `CLAUDE.md` section on `apps/driver` and `packages/*`
  - `app/DRIVER_ROUTES.md`
  - a driver row in `apps/README.md`
- Final architecture audit against section 5.

## 4. Rollback
**Roll back if any of these happen:**
- driver auth or session restore fails
- driver deep links fail
- push registration fails
- driver trip operations regress
- main-app driver-management flows regress
- `/driver/*` breaks main-app routes
- Supabase auth redirect errors
- the native app can't establish a driver session

**How to roll back:**
- Web: flip the main-app flag to `false`. The old flow stays available until Phase 4C.
- Native: don't promote the EAS production build.
- Code: revert the phase's PR.

## 5. Verification and acceptance

| Area | Main | Driver | When |
|---|:-:|:-:|---|
| typecheck, lint, unit, nav-policy, build:graph, madge | ✅ | ✅ | every phase |
| clean checkout + `npm install` | ✅ | ✅ | Phase 2+ |
| web build | ✅ | ✅ | Phase 3+ |
| auth + session restore | ✅ | ✅ | Phase 3+ |
| Supabase/RLS behavior | ✅ | ✅ | preprod |
| deep links, push, background location, camera | — | ✅ | native |
| `/driver/*` hard refresh + static assets | — | ✅ | web |
| legacy URLs | ✅ | — | Phase 4B+ |
| store build | — | ✅ | Phase 5 |

**Architecture:**
- `apps/driver` has 0 imports from `app/` or main-only code, including relative `../app` paths, main-app `@/` aliases and legacy shims.
- `packages/*` have 0 imports from either app.
- `ui` has 0 runtime imports from `domain`.
- The main app has 0 imports from `apps/driver`.
- The boundaries pass, the graph passes, and there are no new cycles.

**Driver web:**
- `/driver`, `/driver/sign-in` and `/driver/sign-up` load directly.
- A hard refresh on `/driver/wallet` and `/driver/trip/:id` still loads.
- Assets resolve under `/driver`.
- Session restore works in all three cases: main-app login then redirect; opening `/driver` with an existing session; opening it with no session (goes to sign-in).
- A non-driver is rejected cleanly.
- Core flows work: dashboard, trip control, chat, wallet, passbook, salary request, available loads and bids, my fleet, commerce mission, expense capture, documents.

**Main web:**
- A driver login goes to `/driver` when the flag is on, and to the old flow when it's off.
- Non-driver behavior is unchanged.
- `/fleet-driver/:id` works, and old `/driver/:uuid` links redirect to it.
- Resources > Drivers works.

**Native:**
- The build uses `com.gogopulse.driver`.
- `pulsedriver://` works, and the `pulse://driver-invite` hand-off works on iOS and Android: fresh install, already installed, and already running.
- Auth, session restore, push, camera and background location work.
- The EAS preview build works.

**Backend:**
- Same Supabase project.
- `supabase/migrations/` is untouched, with no RLS, RPC or trigger change.
- Auth redirect URLs are verified on preprod and then prod.
- CORS is changed only where the inventory required it.

**Deployment:**
- Tested on preprod, rollback tested, prod web deployed, prod native promoted separately.

## 6. Remaining ambiguities (need a decision before or during Phase 0)
1. **Push-token keying:** it is unknown whether `register_push_token` stores tokens per user or per user + device + app. If it's per user only, the extraction stops before the push work.
2. **Old driver web URLs:** `(driver)` is a route group, so today the driver screens sit at root paths like `/wallet` and `/control`. Phase 0 must check which of them also exist in the main app. A redirect that sends everyone from such a path to `/driver/...` would break main-app users.
3. **Store links for the native install screen:** 4A on native needs the Pulse Driver store listing to be live. Until then, the native flag stays `false` even when web is `true`. That means the web and native flags have to be separate.
4. **Observation period for 4D:** not defined. Proposal: 2 weeks of prod web with the flag on.
5. **Accounts:** who owns the Apple/Google developer accounts and the EAS org for `com.gogopulse.driver` (Vasanth sir?), and who sets the prod Supabase Auth redirect URLs. Both are unknown.

## 7. Implementation order
Phase 0 → 1 → 2 → 3 → 3.5 → 4A (web flag) → 4B → Phase 5 preprod stages → Phase 5 prod web → observation → 4C → Phase 5 prod native plus the native flag → 4D → 6.
Each step waits for explicit approval before it starts.
