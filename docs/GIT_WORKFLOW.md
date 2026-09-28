# Git Workflow — how the team works on Pulse

Owner: Nihas (gatekeeper of `V1`). Last updated: 2026-09-24 (afternoon) IST.
Claude uses this file too — keep "Current state", "Open questions" and "Changelog" up to date.

---

## 0. Team

| Person | Role | Reports to |
|---|---|---|
| Vasanth sir | Manager | — |
| Nihas | Lead, gatekeeper of `V1` | Vasanth sir |
| Praveen | Developer | Nihas |
| Sneha | Developer | Nihas |

---

## 0.1 Environments — which code runs where

| Repo / branch | Deployed to | Database |
|---|---|---|
| **[Vasanthgogox/Pulse-app](https://github.com/Vasanthgogox/Pulse-app/tree/V1)** → `V1` (local remote: `vasanth`) | Netlify → **gogopulse.com** (**PROD**) | **Prod DB** `nafxpivddesgsrthmosv` ([dashboard](https://supabase.com/dashboard/project/nafxpivddesgsrthmosv)) |
| `nihas-gogox/Pulse-app` → `V1` (origin + Nihas local) | Netlify → **GX Pulse** URL (**preprod**) | **Preprod DB** `xbisiveavvbifbzyfhgy` |
| [GOGOPulse/Pulse-app](https://github.com/GOGOPulse/Pulse-app/tree/V1) → `V1` (local remote: `gogopulse`) | unknown — not what gogopulse.com runs | unknown |
| `praveen-ggx/Pulse-app`, `snehakumari-ship-it/Pulse-app` | Not deployed | unknown |

⚠️ Vasanth's local `.env` has **prod DB creds only** — anything he runs locally (including migrations / `db:push`) hits the **prod DB**.
⚠️ Every push to `vasanth/V1` goes live on gogopulse.com.

**Path to prod:** Nihas `V1` (preprod) → **Vasanth sir** merges into `Vasanthgogox/Pulse-app` `V1` → Netlify deploys gogopulse.com.
Nihas's local `.env`: PREPROD block active; PROD block present but commented out.

---

## 1. The one-line rule

**Only Nihas merges into `V1`. Everyone else pulls `V1` into their own branch.**

---

## 2. Branches — what each one is for

| Branch | Meaning | Who writes to it |
|---|---|---|
| `vasanth/V1` | Exactly what is live right now (`Vasanthgogox/Pulse-app` `V1` → gogopulse.com) | **Vasanth sir** only |
| `V1` | The next release — the team's shared baseline (deploys to GX Pulse preprod) | Nihas only |
| `<person>/<task>` | One task, e.g. `praveen/compliance-flow` | That person |
| `hotfix/<issue>` | Urgent live fix, e.g. `hotfix/login-crash` | Whoever fixes it (usually Nihas) |

- Work branches are **short-lived**: delete them after they're merged.
- **Don't create timestamped copy branches** (like `v0.0.01-v1-baseline-20260923-1854`). To mark a point, use a tag:
  `git tag v0.0.01-baseline && git push origin v0.0.01-baseline`

---

## 3. Who owns what (to avoid conflicts)

| Person | Area |
|---|---|
| Vasanth sir | Marketplace / Open Market / Network bidding |
| Praveen | Compliance logic (data, totals, pagination, queries) |
| Sneha | Compliance UI (screens, cards, table, icons) |
| Nihas | V1 gatekeeper + own modules |

If two people must edit the **same file**, tell each other first.

---

## 4. Daily routine (everyone)

**Starting a new task**
```bash
git checkout V1 && git pull
git checkout -b <yourname>/<task>
```

**Every morning, and whenever Nihas says "V1 updated"**
```bash
git fetch
git merge origin/V1          # on YOUR branch — this does NOT touch V1
```

**Task finished** → tell Nihas "ready, all working" (or open a PR into `V1`). Nihas merges.

---

## 5. How Nihas merges a teammate's work into V1

Merge each person **separately, only when they say it's finished and working.**

```bash
git checkout V1 && git pull
git fetch
git merge --no-ff origin/<person>/<task>     # real merge, never squash
npm run typecheck && npm test
git push origin V1
```
Then tell the team: **"V1 updated, please pull."**

**Rules**
- **Never squash-merge.** Squash hides history → git re-shows old work as conflicts next time.
- Person keeps working after being merged? Just merge their branch again later — git only brings the new commits.
- Merge **data/logic before UI** when both touch the same feature.

---

## 6. Hotfix — something is broken live

1. Branch from **what's live** (`vasanth/V1`), not our V1:
   ```bash
   git fetch vasanth
   git checkout -b hotfix/<issue> vasanth/V1
   ```
2. Fix **only** that bug. Test it. Push the branch to origin: `git push origin hotfix/<issue>`
3. Ask **Vasanth sir** to merge `hotfix/<issue>` into `Vasanthgogox/Pulse-app` `V1` → Netlify deploys gogopulse.com.
4. **Immediately** bring the fix into our V1 (otherwise the next release brings the bug back):
   ```bash
   git checkout V1 && git merge --no-ff hotfix/<issue> && git push origin V1
   ```
5. Tell the team: **"V1 updated, please pull."** They run `git fetch && git merge origin/V1` on their branches.
6. Delete the hotfix branch.

---

## 7. Conflicts — what to know

- Conflicts come from **two people changing the same lines**, not from how many commits someone has.
- Pulling V1 often doesn't create conflicts — it finds them **early and small**, and the person who wrote the code fixes them.
- Pull went wrong? `git merge --abort` → branch is back exactly as before. Nothing lost.
- Nervous before a big pull? Make a backup first: `git branch backup-<name>-<date>`

---

## 8. Keeping track as branches pile up

```bash
git fetch --prune
git branch -r --no-merged origin/V1    # work NOT yet in V1 (still pending)
git branch -r --merged origin/V1       # finished — safe to delete
git log --oneline origin/V1..origin/<person>/<task>   # what that person has that V1 doesn't
```
Check this once a week and delete merged branches.

---

## 9. Current state (as of 2026-09-24)

`V1` = `149fba7d` = Vasanth's V1 up to `80589762448009f6a8b61d6a1a0d84998b037477` + Adhi fixes (`a8f87e08`) + this doc. Local `V1` = `origin/V1` (in sync). Deployed to GX Pulse preprod.
**Live (gogopulse.com)** = `vasanth/V1` `997064af` — 1 commit ahead of our base, and missing Adhi fixes.
All three branches below started from `a8f87e08`. **None merged yet.**

| Branch | What's in it | Status / plan |
|---|---|---|
| `vasanth/V1` (`997064af`) | Search-first Marketplace, Open Market, Network keypad bidding, 4 DB migrations | Merges clean. **Merge now**, before Nihas starts own work |
| `praveen/compliance-flow` (`ccba1346`) | Compliance totals for full Loading→Completed pipeline, pagination, pipeline query | **Wait** until Praveen says "all working" |
| `sneha/compliance-ui` (`2cd2710a`) | Compliance summary metrics, status icon, table styling | Merge **after (or with) Praveen** — her branch already contains Praveen's older compliance commit (`85e8a724`) |

**Known conflict (only one):** `app/compliance/index.tsx` subtitle — Praveen: "{N} trips · Loading→Completed" + page range; Sneha: "{N} trips on this page". Recommended: keep Praveen's (his count covers all trips, not one page).

**Planned order:** Vasanth → (Nihas's own work) → Praveen → Sneha.

---

## 10. Open questions — things we don't know yet

- [x] ~~Which repo/branch is live?~~ → **`Vasanthgogox/Pulse-app` `V1`** on Netlify (gogopulse.com, prod DB `nafxpivddesgsrthmosv`). Corrected 2026-09-24 — earlier note said GOGOPulse, that was wrong.
- [x] ~~Who deploys to prod?~~ → Vasanth sir, by pushing to his own `V1`.
- [ ] **What is `GOGOPulse/Pulse-app` for?** It's at `80589762` (older than live). Mirror / future org repo / unused?
- [ ] ⚠️ **Live code needs DB changes that aren't applied:** live = `vasanth/V1` `997064af`, which includes 4 migrations (`20270922165000`, `20270923135205`, `20270923194500`, `20270923201500`) **not on the prod DB**. Marketplace search features may be broken on gogopulse.com until they're applied.
- [ ] **Network Loads column shows a 15-card, one-per-route sample** (Abitha Transport: column says 27, real open loads ≈373 across 107 routes). Intentional? Asked Vasanth 2026-09-24.
- [ ] **Hotfix path:** Nihas can't push to prod repo — does every hotfix go through Vasanth sir? (section 6 assumes Nihas prepares the fix, Vasanth pushes it)
- [x] ~~Were Vasanth's 4 new migrations pushed to prod?~~ → **No** (checked 2026-09-24). But see the next items.
- [ ] ⚠️ **Same migration, two timestamps:** prod has `20260923135233_market_indents_show_open_loads_for_new_friends` (not in any git branch — applied directly on prod). `vasanth/V1` has the same-named file as `20270923135205_…`. After merging Vasanth, `db:push` would run it **again**. Ask Vasanth: rename the file to `20260923135233` or confirm it's safe to re-run.
- [ ] ⚠️ **3 migrations in V1 code but NOT on prod or preprod DB** (all from Vasanth's commit `5d7e34cb`, which is live code): `20260901050000_organization_team_invites_prerequisite`, `20270921182802_pause_diagnostic_crons_during_unhealthy`, `20270922143500_guard_http_queue_url_and_rpc_grants`. Ask Vasanth: intentionally held back, or forgotten?
- [ ] **Why 2027 timestamps?** Most recent migrations (repo + prod) are dated 2027. Harmless for ordering, but confusing — agree on a convention with Vasanth.
- [x] ~~Preprod vs prod drift?~~ → Preprod = prod minus `20260923135233` (checked 2026-09-24: prod 869, preprod 868, V1 repo 871).
- [ ] **Is V1 protected on GitHub** (so only Nihas can push)? If not, consider turning on branch protection.
- [ ] **PRs or direct merges?** Should teammates open a PR into V1 for review, or just tell Nihas?
- [ ] **Old copy branches** (`v0.0.01-v1-*`): keep them as history or replace them with tags and delete them?

---

## 11. Cheat sheet

| I want to… | Command |
|---|---|
| Start a task | `git checkout V1 && git pull && git checkout -b me/task` |
| Get latest team work into my branch | `git fetch && git merge origin/V1` |
| Undo a bad merge in progress | `git merge --abort` |
| See what's not in V1 yet | `git branch -r --no-merged origin/V1` |
| Mark a point in history | `git tag <name> && git push origin <name>` |

---

## 12. Changelog

Newest on top. Add one line every time `V1` (or prod) changes.

| Date | What happened to V1 | V1 commit |
|---|---|---|
| 2026-09-25 | Praveen compliance-flow + Sneha compliance-ui merged on separate branches, then fast-forwarded into V1. Full story in [CHANGELOG.md](../CHANGELOG.md) | `787312c1` |
| 2026-09-24 | **Correction:** gogopulse.com runs `Vasanthgogox/Pulse-app` `V1` (`997064af`), not GOGOPulse. Found via Abitha Transport "Network Loads 27" issue (15-card route-dedup sample in `997064af`) | `149fba7d` |
| 2026-09-24 | Workflow doc committed to V1 | `149fba7d` |
| 2026-09-24 | Checked prod DB migrations: Vasanth's 4 new ones NOT applied; 1 ad-hoc migration on prod not in git; 3 V1 migrations missing on both DBs (see section 10) | `a8f87e08` |
| 2026-09-24 | Checked GOGOPulse repo: `V1` = `80589762`. (Wrongly assumed this was live — corrected above) | `a8f87e08` |
| 2026-09-24 | Doc created. Environments + team recorded. Vasanth pushed `997064af` (Marketplace search) to `vasanth/V1` — not merged into V1 yet | `a8f87e08` |
| 2026-09-23 | Praveen compliance-flow squashed onto baseline → separate branch `v0.0.01-v1-post-praveen-compliance-merge-20260923-1839` (`85e8a724`). **Not** in V1 | `a8f87e08` |
| 2026-09-23 | Adhi fixes (`new-fix-adhi` `e49fb71f..06416244`) merged onto V1 | `a8f87e08` |
| 2026-09-23 | V1 started from Vasanth's V1 at `80589762448009f6a8b61d6a1a0d84998b037477` | `80589762` |
