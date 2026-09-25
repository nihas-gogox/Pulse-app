# Driver Extraction — Phase 4A preprod verification checklist

For: the GX Pulse preprod site only. Code: `b77d7aa7` (Phase 4A). Prod (gogopulse.com) keeps the flag **unset** throughout.
Run it in the order below. Fill in the Result column (PASS / FAIL + note) as you go; a FAIL stops the run.

## Setup
| Placeholder | Value to use |
|---|---|
| `$HOST` | the GX Pulse preprod URL, e.g. `https://<gx-pulse>.netlify.app` |
| `$UUID` | a real dispatcher-side driver id (open a driver from Resources → Drivers on preprod and copy it from the URL) |
| Driver account | a preprod account with `role = driver` |
| Dispatcher account | a preprod account with `fleet_management` |
| Browser | a **fresh incognito window per section** (clean storage; see observation O1) |

Test with `curl` for the server behavior (this is real Netlify, not the local emulator) and with the browser for the app behavior.
`curl -sI` prints the status and `Location`. `curl -s $URL | grep -o '<title>[^<]*'` shows which app served the page: **PULSE** = main app, **Pulse Driver** = driver app.

---

## Deploy 1: flag OFF (production-style)
Preprod site env: `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` **not set**. Deploy `b77d7aa7`.

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 1.1 | Build log | Netlify deploy log | `[build-ci] Pulse Driver web app NOT included …`; no `driver export` step | |
| 1.2 | No driver app deployed | `curl -sI $HOST/driver/index.html` | not a Pulse Driver page (404 or main `index.html`); `curl -s $HOST/driver/wallet \| grep -o '<title>[^<]*'` → **PULSE** | |
| 1.3 | No generated rules | `curl -sI $HOST/_redirects` | 404 (Netlify never serves it), and 1.4–1.6 behave like the main app | |
| 1.4 | Old dispatcher link, signed out | `curl -sI $HOST/driver/$UUID` | **200 main app** (no server 301 when the flag is off) | |
| 1.5 | Old dispatcher link → new URL (dispatcher signed in) | browser: open `$HOST/driver/$UUID?tab=ledger` | URL becomes `$HOST/fleet-driver/$UUID?tab=ledger`; the dispatcher driver-detail page opens on the Ledger tab | |
| 1.6 | Same for subpages | `$HOST/driver/$UUID/analytics`, `$HOST/driver/$UUID/profile` | become `/fleet-driver/$UUID/analytics`, `/profile`; the correct pages open | |
| 1.7 | Internal links | as dispatcher: Resources → Drivers → open a driver; also from trip detail, finance and compliance docs | every link lands on `/fleet-driver/<id>…`; the page works | |
| 1.8 | Old driver sign-in (rollback flow) | `$HOST/driver-sign-in` signed out | **main app** driver sign-in page; URL stays `/driver-sign-in` | |
| 1.9 | Old driver sign-up | `$HOST/driver-signup` | main app driver sign-up; URL stays | |
| 1.10 | Old driver onboarding | `$HOST/onboarding/driver` | → `/driver-signup` (main app), as before | |
| 1.11 | No hand-off for a driver | sign in as the **driver** on `$HOST/driver-sign-in` | lands on the old in-app driver dashboard at `$HOST/` (not `/driver`); wallet/trip history open in the main app | |
| 1.12 | Dispatcher unchanged | sign in as the **dispatcher** | normal main app (trips, finance, resources); nothing redirects to `/driver` | |

---

## Deploy 2: flag ON
Preprod site env: `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED = true`. Redeploy **the same commit**.

### Build / deploy
| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 2.1 | Build log | Netlify deploy log | `[build-ci] driver export ok …`, `copy driver ok`, and `Pulse Driver web app included at /driver (EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED=true)` | |
| 2.2 | Driver app served | `curl -s $HOST/driver \| grep -o '<title>[^<]*'` | **Pulse Driver** | |
| 2.3 | Driver assets | open `$HOST/driver` in the browser → DevTools Network | every JS/asset request is under `/driver/_expo/…` or `/driver/assets/…` with **200**; none from the root `/_expo/` | |
| 2.4 | Missing driver chunk | `curl -sI $HOST/driver/_expo/static/js/web/nope.js` | **404** (not HTML) | |
| 2.5 | Driver cache headers | `curl -sI $HOST/driver/index.html` | `Cache-Control: no-cache, no-store, must-revalidate`; a hashed `/driver/_expo/static/...js` → `max-age=31536000, immutable` | |
| 2.6 | Kill switch really inlined (cache check) | `curl -s $HOST/ \| grep -o '/_expo/static/js/web/entry-[^"]*'`, then fetch that file: `curl -s $HOST<entry> \| grep -o 'isDriverWebHandoffEnabled=function(){return![01]}'` | `…return!0}` (= on). If it prints `return!1}` the Metro cache served the old value: **FAIL**, stop | |

### Real Netlify rewrite behavior (server, signed out)
| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 2.7 | Driver routes | for each of `/driver`, `/driver/`, `/driver/sign-in`, `/driver/sign-up`, `/driver/onboarding`, `/driver/wallet`, `/driver/control`, `/driver/chat`, `/driver/profile`, `/driver/passbook/history`, `/driver/trip-history`, `/driver/trip/x1`, `/driver/trip/x1/verification`, `/driver/trip/x1/operations/other`, `/driver/my-fleet/add`, `/driver/salary-request/x1`, `/driver/language-settings`: `curl -s -o /dev/null -w '%{http_code}' URL` and the title check | 200 and **Pulse Driver** for every one | |
| 2.8 | Legacy dispatcher link | `curl -sI "$HOST/driver/$UUID?tab=ledger"` | **301**, `Location: /fleet-driver/$UUID?tab=ledger` (query kept) | |
| 2.9 | Legacy subpages | `curl -sI $HOST/driver/$UUID/analytics`; `…/profile` | 301 → `/fleet-driver/$UUID/analytics`, `/profile` | |
| 2.10 | Dispatcher detail not captured | `curl -s $HOST/fleet-driver/$UUID \| grep -o '<title>[^<]*'` | **PULSE** (main app) | |
| 2.11 | Main paths not captured | `/driver-sign-in`, `/driver-signup`, `/driver-trip/x1`, `/wallet`, `/trip/x1`: title check | **PULSE** (the main app serves them; any hand-off happens in the browser, 2.13) | |
| 2.12 | `/driver` without a trailing slash, and with `?x=1` | `curl -sI "$HOST/driver?x=1"` | 200 Pulse Driver (no 301 loop) | |

### Browser, signed out (fresh incognito)
| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 2.13 | Old auth/onboarding URLs hand off | open `$HOST/driver-sign-in?ref=x`, `$HOST/driver-signup`, `$HOST/onboarding/driver` | → `/driver/sign-in?ref=x` (query kept), `/driver/sign-up`, `/driver/sign-up`; the page title is Pulse Driver | |
| 2.14 | Driver private pages | `$HOST/driver/wallet`, `/driver/trip/x1` (hard refresh each) | → `/driver/sign-in` | |
| 2.15 | Legacy driver names inside the app | on `/driver/sign-up` click "Already activated? Sign in" | → `/driver/sign-in` (never `/-sign-in`) | |
| 2.16 | Marketing link | on `/driver/sign-in` (desktop width) click "Pulse website" | → `$HOST/terminal-website` (main app) | |
| 2.17 | Anonymous main app unchanged | `$HOST/`, `$HOST/sign-in`, `$HOST/wallet` | same as Deploy 1 (`/` → marketing, `/sign-in` stays, `/wallet` → `/sign-in` → marketing) | |

---

## Authenticated checks (flag ON, fresh incognito per account)
| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 3.1 | Driver signs in via the **driver app** | `$HOST/driver/sign-in` → phone OTP | lands on `$HOST/driver` (dashboard); no main-app chrome | |
| 3.2 | Driver enters the **main app** | same window: open `$HOST/` | → `$HOST/driver` (hand-off) | |
| 3.3 | Driver on an old in-app URL | open `$HOST/wallet`, `$HOST/driver-trip/<a real trip id>` | → `$HOST/driver/wallet`, `$HOST/driver/trip/<id>` | |
| 3.4 | Driver signs in via **main** `/sign-in` | new incognito: `$HOST/sign-in` as the driver | after login → `$HOST/driver` | |
| 3.5 | Session restore: existing session | close the tab, reopen `$HOST/driver` | still signed in; dashboard | |
| 3.6 | Session restore: hard refresh | on `/driver/wallet` and `/driver/trip/<id>` press refresh | the same page reloads signed in | |
| 3.7 | Session restore: main login → driver | 3.4 above (session carried from the main app to `/driver`, same origin) | no second login | |
| 3.8 | Driver sign-out | driver app → Profile → sign out | → `/driver/sign-in`; `$HOST/driver/wallet` → sign-in | |
| 3.9 | Core driver flows (smoke) | dashboard, trip control, trip detail, chat, fuel/toll/other expense (`/driver/trip/<id>/operations/…`), odometer verification, wallet, passbook, salary request, language settings | each opens and works; record any that don't | |
| 3.10 | Non-driver rejected by the driver app | as the **dispatcher**: open `$HOST/driver` | "This app is for drivers" screen; "Go to Pulse" → `$HOST/`; "Sign out" works | |
| 3.11 | Dispatcher detail | as the dispatcher: `$HOST/fleet-driver/$UUID` | the driver-detail page opens (trips / ledger tabs work) | |
| 3.12 | Dispatcher legacy link | as the dispatcher: `$HOST/driver/$UUID?tab=ledger` | 301 → `/fleet-driver/$UUID?tab=ledger`, the detail page on Ledger | |
| 3.13 | Dispatcher not handed off | as the dispatcher: `$HOST/`, trips, finance | normal main app; never redirected to `/driver` | |
| 3.14 | Google sign-in on the driver sign-up (record only) | `/driver/sign-up` → "Continue with Google" | record the outcome. If Supabase rejects the redirect URL, that's a Phase 5 Supabase Auth setting: **don't change Supabase in 4A** | |

---

## Deploy 3: rollback
Remove `EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED` from the preprod site (or set it to anything other than `true`). Redeploy **the same commit without clearing the Netlify cache**; this tests that the kill switch survives caching.

| # | Check | How | Expected | Result |
|---|---|---|---|---|
| 4.1 | Build log | deploy log | `Pulse Driver web app NOT included` | |
| 4.2 | Flag really off in the bundle (Metro cache) | repeat 2.6 | `isDriverWebHandoffEnabled=function(){return!1}`. If `!0`: **FAIL** (a stale cache would keep handing off) | |
| 4.3 | Driver app gone | `curl -s $HOST/driver/wallet \| grep -o '<title>[^<]*'` | **PULSE** | |
| 4.4 | No 301 left over | `curl -sI $HOST/driver/$UUID` | 200 main app (the in-app redirect takes over, as 1.4/1.5) | |
| 4.5 | Old flow back | repeat 1.8–1.12 | the same results as Deploy 1 | |
| 4.6 | Signed-in driver back in the old flow | as the driver (fresh incognito): `$HOST/` | the old in-app driver dashboard at `$HOST/`; **no** redirect to `/driver` | |
| 4.7 | Browser cache | in a window used during Deploy 2: hard refresh `$HOST/` and `$HOST/driver-sign-in` | the old behavior (the main `index.html` is no-cache) | |

After 4.7, re-enable the flag (Deploy 2 settings) only if continuing 4A validation. Prod stays unset.

---

## Observations (record, don't fix)
**O1: signed-in `/sign-in` crash, unexplained.**
- **Seen locally:** a leftover preprod session of unknown origin was in the test browser's storage, and with it main `/sign-in` showed "Something went wrong". The console said "Attempted to navigate before mounting the Root Layout component".
- **In preprod:** in a fresh incognito window, sign in on the main app, then open `$HOST/sign-in` directly. Do it with the flag OFF and with the flag ON.
- **Record:** whether it reproduces, the account role, the flag state, the console error.
- Fix only if it reproduces from clean storage, and then as its own change (it may be pre-existing and unrelated to the extraction).

| Flag | Role | Reproduces? | Console | Result |
|---|---|---|---|---|
| OFF | dispatcher | | | |
| OFF | driver | | | |
| ON | dispatcher | | | |
| ON | driver | | | |

## Out of scope for this checklist
Phase 4B (other legacy URL redirects, removing old routes), removing shims, native hand-off, EAS, push, Supabase changes.
