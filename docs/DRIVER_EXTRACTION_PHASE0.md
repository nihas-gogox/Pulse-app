# Driver Extraction — Phase 0 Findings

Date: 2026-09-24 · Branch: `nihas/driver-app-extraction` · Plan: `docs/DRIVER_EXTRACTION_PLAN.md`
Inventory (generated): `docs/DRIVER_EXTRACTION_INVENTORY.md`. Regenerate it with `node scripts/driver-extraction-inventory.mjs --json`.

Phase 0 is read-only. No production code, migration or DB change was made.

## 1. Graph numbers

| | Files |
|---|---:|
| Source files scanned (root app) | 3148 |
| Driver seed files (non-test) | 184 |
| Driver transitive closure | 1200 |
| Main-app transitive closure (not walking through driver code) | 2231 |
| Direct imports main → driver seed | 129 edges (**17** come from files that are live in the main app; the rest come from driver-self screens in `features/drivers/screens` and their helpers) |
| Suggested DRIVER_ONLY / SHARED_CORE / SHARED_DOMAIN / SHARED_UI / REVIEW | 219 / 18 / 172 / 145 / **646** |

**What this means:** the driver app pulls in **1200 files**, not 187. It reaches deep into `features/trips/operations`, `features/finance/components`, `features/chat/components`, `features/trips/verification`, `lib/platform` and `lib/hooks`. Those 646 `REVIEW` files are mostly shared *business components*, which don't fit core, domain or ui by path. Each one has to be classified by hand before Phase 1 moves anything.

## 2. Push tokens — ⛔ BLOCKER for native push (per contract: stop and raise it)
- `register_push_token` (latest definition: `supabase/migrations/20260919000000_trip_room_history_backfill_and_push.sql:335`) upserts into `user_push_tokens` with `ON CONFLICT (user_id, token)`. **There is no app column.**
- A second app on the same device gets a different Expo token, so tokens are **not overwritten**.
- **The problem:** `supabase/functions/send-push-notifications/index.ts:77-115` loads *every* token for a user and sends them all to Expo in **one request**.
  - Expo rejects a request that mixes tokens from different projects.
  - Once Pulse Driver (a new EAS project) registers a token, batches containing both apps' tokens fail. The error is swallowed, and the rows are marked sent anyway.
  - The main app would also receive driver pushes.
- **This needs a backend decision, outside the extraction:** add an app/project column to the tokens, or have the sender group requests per project. Until then, **Phase 3 must not wire push** in the driver app. Web and the non-push phases can go ahead.

## 3. CORS
- 6 functions use a single exact-match origin (`CORS_ALLOWED_ORIGIN` env var, `getCorsOrigin`): `link-driver-phone`, `driver-phone-signin-unverified`, `check-user-by-phone`, `invite-platform-admin`, `razorpay-create-order`, `marketplace-test-payment`. The rest return `*`.
- **Path mode (gogopulse.com/driver):** same origin → **no change needed.**
- **Domain mode (driver.gogopulse.com):** a single-value env var can't allow two origins. The driver sign-in functions (`driver-phone-signin-unverified`, `link-driver-phone`, `check-user-by-phone`) would **need an Edge Function code change**, a multi-origin allowlist. That's deferred until domain mode and needs approval then.

## 4. Route URL collisions (answers ambiguity #2)
`(driver)` is a route group, so today's driver screens sit at root URLs. Five of them clash with main-app routes:

| URL | Driver file | Main-app file |
|---|---|---|
| `/` | `app/(driver)/index.tsx` | `app/index.tsx` |
| `/chat` | `app/(driver)/chat.tsx` | `app/chat.tsx` |
| `/loading` | `app/(driver)/loading.tsx` | `app/loading.tsx` |
| `/notifications` | `app/(driver)/notifications.tsx` | `app/notifications/index.tsx` |
| `/profile` | `app/(driver)/profile.tsx` | `app/(tabs)/profile.tsx` |

→ The Phase 4B legacy redirects **must not** redirect these 5 URLs to `/driver/*`, or main-app users would break. Only the non-colliding driver URLs get a 301. The full list is in the inventory, under "Driver route URLs".

Main-app routes under `/driver` (these clash with the new web path, so they move to `/fleet-driver`): `/driver/[id]`, `/driver/[id]/analytics`, `/driver/[id]/profile`, `/driver/loading`.

## 5. Cycles
The graph has 16 cycles, counting type-only edges. That is more than the 5 that `madge` knows about, because this graph also follows dynamic imports and type edges. The list is in the inventory. **Cycles touching driver code are marked `[driver]`** and are the reference for "no new cycles".

## 6. Baseline (V1 `149fba7d`, before any extraction change)

**V1 is already red.** Phase gates therefore mean **"no new failures compared with this baseline"**, not "all green". Logs are in `docs/driver-extraction-baseline/` (local only; `*.log` is gitignored).

| Check | Result |
|---|---|
| `test:navigation-policy` | ✅ 9 suites, 64 tests pass |
| `npm test` | ❌ 5 failed / 2644 passed. 2 suites fail: `logPods.service.concurrency.test.ts` and `mutualConnectionsPartnerDisplay.test.ts` |
| `typecheck` | ❌ 26 errors in 10 files, e.g. `logPods.service.ts`, `mutual-connections.service.ts`, `useGlobalSyncStore.ts` |
| `lint` | ❌ 96 errors, 355 warnings |
| `build:graph:strict` | ❌ startup-graph barrel contamination (e.g. `lib/platform/index.ts`) |
| `madge --circular` | not run (madge isn't installed locally; adding it needs approval). The inventory's own cycle list is used instead |
| `build:web` | not run; it would overwrite the local `dist/` |
| clean checkout + `npm install` | not run; the checks above ran on the existing working tree |

None of these failures are in driver code, and none were fixed (scope discipline).

## 7. Found, not fixed (scope discipline)
- `supabase/migrations/20260919000000_trip_room_history_backfill_and_push.sql` has a `000000` time component. `CLAUDE.md` says this repo must never create one, because it risks colliding with pulse-unified-base. Not touched; flagged for Nihas and Vasanth.
- `send-push-notifications` marks outbox rows sent even when Expo delivery fails, which can hide errors. Not touched.
