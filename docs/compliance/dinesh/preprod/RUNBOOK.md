# Preprod runbook — decline migration `20270929162901`

Preprod only: `xbisiveavvbifbzyfhgy` ("pre-prod"). Prod `nafxpivddesgsrthmosv` is never targeted: no command here takes a project ref, and every SQL step goes through `run.sh`, which aborts unless the linked ref is preprod.
Run from the repo root on branch `compliance-dinesh-sir`. **Stop at the first FAIL** and report it. Do not continue and do not fix anything on the database by hand.

## 0. Preconditions (all must hold)
- [ ] Written authorization to apply `20270929162901` to preprod.
- [ ] D2 answered. If Vehicle/Driver must block Verify, stop: a separate migration has to be designed and reviewed first.
- [ ] `git status` is clean, and HEAD is the reviewed commit.

## 1. Apply
```bash
cat supabase/.temp/project-ref
# MUST print exactly: xbisiveavvbifbzyfhgy   — anything else: STOP.
test "$(cat supabase/.temp/project-ref)" = "xbisiveavvbifbzyfhgy" || { echo "ABORT: not preprod"; exit 1; }

npm run db:preflight
# MUST end "Preflight passed" and list exactly 1 pending: 20270929162901_trip_compliance_decline.sql

supabase db push --linked --dry-run
# MUST list only 20270929162901_trip_compliance_decline.sql

supabase db push --linked
```

## 2. Verify the remote state immediately
```bash
supabase migration list --linked | tail -3        # 20270929162901 present in the Remote column
bash docs/compliance/dinesh/preprod/run.sh docs/compliance/dinesh/preprod/01_schema_checks.sql
```
`01_schema_checks.sql` is read-only and **every row must be PASS**. It checks:
- all 3 columns, their types, nullable, no default, no backfill;
- the FK is `ON DELETE SET NULL`, and the check constraint is validated for 3..500;
- the decline function is SECURITY DEFINER with `search_path=public`, owned by postgres;
- the guard function is not SECURITY DEFINER, and the guard trigger is enabled on exactly the 3 columns;
- EXECUTE rights: authenticated yes, anon no, PUBLIC no; the guard function can't be executed by anon or authenticated;
- `mark_trip_compliance_verified` still requires exactly `lr, invoice, eway_bill`.

## 3. Security acceptance (rolled back)
```bash
bash docs/compliance/dinesh/preprod/run.sh docs/compliance/dinesh/preprod/02_security_tests.sql
```
The whole script is one transaction that ends in `ROLLBACK`. It uses synthetic `@example.invalid` users on an existing unverified trip. **Every row must be PASS**; the `12-info` row is informational.

| # | Proves |
|---|---|
| 01 | Authorized member declines; reason, time and `declined_by` are persisted; trip stays unverified |
| 02 / 03 / 04 / 05 | No surface / other org / inactive member / anon are rejected; nothing is written |
| 06 | Direct UPDATE of any decline column via API roles is rejected (42501); unrelated columns still update |
| 07 / 08 / 09 | Whitespace-only, <3 characters and >500 characters are rejected; nothing is written |
| 10 | 3 and 500 characters are accepted (500 via the org-admin shortcut) |
| 11 | Replaying an idempotency key adds no event and doesn't overwrite the reason |
| 12 | Deleting a user referenced only by `compliance_declined_by` succeeds, and the column becomes NULL |
| extra | Decline on an already-verified trip is rejected |

`12-info` is expected to show an error. A user who has any `trip_workflow_events` row is blocked by the **pre-existing** `trip_workflow_events_actor_id_fkey` (no ON DELETE). V1 has the same behaviour for every event type; it isn't caused by this migration.

## 4. Lifecycle (rolled back)
```bash
bash docs/compliance/dinesh/preprod/run.sh docs/compliance/dinesh/preprod/03_lifecycle.sql
```
**Every row must be PASS.** The steps are:
1. L01–L05: pending → valid decline → persisted reason/time/by → read back as the member through RLS (the app's select) → audit event.
2. L06–L08: second decline replaces the reason and keeps history (`previous_reason`), and a replayed key is a no-op.
3. L09–L13: the Verify rule is exactly LR + E-way Bill + Invoice. It is blocked while the E-way Bill is pending, allowed once all three are verified (vehicle/driver aren't checked by the server), and a decline after verify is rejected.

## 5. Cross-session persistence (COMMITTED — needs separate explicit authorization)
Steps 3–4 roll back, so they can't prove that a reload or another user sees the decline. This step **leaves permanent data**:
- a decline on one designated QA trip;
- one `compliance.declined` event, which can't be deleted by app users (audit history).

Do it only when authorized, with the dedicated QA account and a QA-owned trip:
1. In the preprod web app (Table view), decline the QA trip with a reason, **without** Playwright interception.
2. Hard-reload the page. The row shows "Declined" and the reason. Open Details: "Compliance Declined" shows the full reason and time.
3. Log in as a second QA user in the same org, or in another browser profile, and check the same.
4. Read back (read-only), filling in the QA trip id:
   `select compliance_declined_at, compliance_decline_reason, compliance_declined_by is not null from public.trips where id = '<qa-trip-id>';`

## 6. E2E (after section 7 passes)
```bash
bash docs/compliance/dinesh/preprod/qa_check.sh        # read-only; must be all PASS
npx playwright test e2e/compliance --reporter=list
```
Report **passed / failed / skipped**, with the reason for every skip. A run with skips is **not** an E2E pass. The release can't claim E2E validation while a required scenario is skipped.

## 7. QA prerequisites (checked by `qa_check.sh`)
- `e2e/.env.e2e` holds `E2E_EMAIL` and `E2E_PASSWORD` for a **dedicated** QA account; never a real user. `E2E_MEMBER_ID` isn't needed for these tests.
- The account is an **active** member of the org the app opens into.
- That org has `workspace_products.product_id = 'pulse_compliance'` with status `active` or `trial`.
- The account is owner or admin, or has `permissions.surfaces["trip_compliance.trip.mark_verified"] = true`.
- Fixtures in that org:
  - ≥1 unverified trip, for the decline tests;
  - ≥1 unverified trip whose latest LR, E-way Bill and Invoice are all approved, for the verify-failure test.
- One account is enough. Multiple roles are only needed for the manual step 5.3.
- The web server is started by Playwright (`npm run web`, port 8081, pointed at preprod via `.env`).

## If anything FAILs after the push
Stop and report. The rollback is a **new** compensating migration (see `../MIGRATION.md` § Rollback). It must be reviewed and authorized separately; never edit `20270929162901`.

## Files
| File | Purpose |
|---|---|
| `run.sh` | Refuses to run unless the linked ref is preprod, then runs one SQL file |
| `01_schema_checks.sql` | Read-only schema/grant checks |
| `02_security_tests.sql` | Generated; security tests 1–12, rolled back |
| `03_lifecycle.sql` | Generated; lifecycle, rolled back |
| `_fixtures.sql`, `*.body.sql`, `build.sh` | Sources for 02/03 (`bash build.sh` regenerates them and refuses any COMMIT) |
| `05_qa_account_check.sql`, `qa_check.sh` | Read-only QA account/fixture check (the email is never printed) |
