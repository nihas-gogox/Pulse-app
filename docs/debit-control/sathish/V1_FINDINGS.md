# V1 findings found during the Debit Control audit — OWNER REQUIRED

These are **V1 defects, not Debit Control decisions**. They must not be fixed inside `debit-control-sathish`. Each needs an assigned owner and its own branch and review.

They were observed on 2026-09-29. Evidence comes only from repo reads and **read-only** catalog queries (`pg_proc`, `information_schema`, `to_regclass`) against linked **preprod `xbisiveavvbifbzyfhgy`**. The RPC was **not** called and no data was read or written. Prod (`nafxpivddesgsrthmosv`) was not checked: unknown.

---

## Finding A — SECURITY FINDING — OWNER REQUIRED

**Function:** `public.get_trips_for_pod_org(p_org_id uuid) RETURNS SETOF json`

**Evidence (preprod catalog):**
- `prosecdef = true` (SECURITY DEFINER, so it runs as `postgres` and bypasses RLS on `trips`, `suppliers`, `clients`)
- ACL: `authenticated=X` (any logged-in user can execute it)
- Body (md5 `925b9aceec2fbcd6f2a565a935cd9fe9`) contains no `auth.uid()`, no `organization_members` / `my_organization_ids()` check and no `has_member_surface`:
  ```sql
  SELECT row_to_json(q) FROM (SELECT DISTINCT ON (tr.id) tr.* FROM trips tr
   WHERE tr.organization_id = p_org_id
      OR EXISTS (SELECT 1 FROM suppliers s WHERE s.id = tr.supplier_id AND s.linked_organization_id = p_org_id)
      OR EXISTS (SELECT 1 FROM clients c WHERE c.id = tr.client_id AND c.organization_id = p_org_id)
   ORDER BY tr.id, tr.created_at DESC) q ORDER BY q.created_at DESC LIMIT 5000;
  ```
- Source: `supabase/migrations/20260524120000_connection_reducing_rpcs_batch2.sql`. Later grant: `20260728210000_v2_audit_anon_rpc_revoke.sql` (keeps `authenticated`).

**Missing authorization:** the function never checks that the caller is a member of `p_org_id`. Any authenticated user who knows or guesses an org UUID can get up to 5000 full `trips` rows (`tr.*`: prices, supplier rate, driver, locations, compliance fields) for that org and its linked trips.

**Affected surface (re-traced 2026-09-29):**
- The POD Reconciliation screen (`app/pod-reconciliation`) calls the RPC through `mergeTripsForPodOrg` (`podReconciliationService.ts:98`) in two places:
  - the list: `fetchReconciliationTrips` ← `usePodReconciliationTripsQuery`
  - the summary: `fetchPodReconciliationSummary` (`invoicing.service.ts:712`) ← `usePodReconciliationSummaryQuery`
- **Correction:** Invoicing screens do **not** consume it. `lib/queries/useInvoicingExecuteQueries.ts` has a summary hook that calls it, but no screen uses that hook. `financeReadPathLoad.util.ts` states the invoice read path is deliberately separate.
- The in-app UI gate (`finance.pod_reconciliation`) does not protect the RPC. It is callable directly at `/rest/v1/rpc/get_trips_for_pod_org` with any authenticated JWT.

**Team-lead re-verification (read-only, 2026-09-29):**
- Only one overload exists: `get_trips_for_pod_org(uuid)`, returning `json`, with `search_path=public`
- Owner `postgres`, which has `rolbypassrls = true`. `trips` / `suppliers` / `clients` have RLS enabled but **not forced**, so RLS is bypassed inside the function
- `has_function_privilege`: `authenticated` = true, `anon` = false
- Caller identity checked: **no**. Org membership checked: **no**. Org selection: the caller-supplied `p_org_id` alone
- Exposed data: every `trips` column (`tr.*`: `client_price`, `supplier_rate`, `margin`, `advance_paid`, driver/vehicle ids, pickup/drop coordinates, `notes`, compliance reasons…) for trips owned by `p_org_id` or linked to it as supplier/client. Max 5000 rows
- Live body matches the repo migration text

**Status: CONFIRMED (≥90%) on preprod** from definition + privileges + role attributes. Not attempted as an exploit. **Elsewhere: NEEDS VERIFICATION.** Prod was not queried, and the sibling repo `pulse-unified-base` is not on this machine, so a later redefinition there cannot be ruled out.

**Recommended owner / action:** the DB/security owner for finance read paths (to be assigned). Add a caller-membership guard, e.g. raise unless `p_org_id` is in `my_organization_ids()`, matching the pattern used by other org RPCs. Ship it as its own migration with a rolled-back test proving a non-member gets an error and a member gets identical rows. Also check whether the other `SECURITY DEFINER` + `p_org_id` RPCs in the same migration have the same gap: unknown until checked. Debit Control must not ship on top of this RPC until it is fixed.

---

## Finding B — AUDIT INTEGRITY FINDING — OWNER REQUIRED

**Function referenced:** `public.log_activity(p_action, p_entity_type, p_entity_id, p_details)`

**Evidence:**
- Preprod: `pg_proc` has **0 rows** named `log_activity` in any schema. `to_regclass('public.activity_logs')` = `NULL`.
- No migration in `supabase/migrations/` creates it.
- Callers in V1:
  - `features/pod-reconciliation/components/PodValidationView.tsx:276`: `POD_VALIDATED` (shortage/damage/penalty, remarks, original and final amount). The result is not checked.
  - `features/log-pods/services/logPods.service.ts:304`: `POD_LOGGED` (bulk hard-copy received). Errors are only `console.warn`.
  - `features/log-pods/services/logPods.service.ts:619`: `POD_LOGGED` (Log Incoming PODs). Errors are only `console.warn`.
- `features/invoicing/services/invoicing.service.ts:291` already hides `log_activity` / `activity_logs` errors behind a generic message, so the gap was known in at least one path.

**Team-lead re-verification (read-only, 2026-09-29):**
- `pg_proc` search for `%log_activ%` / `%activity_log%` in **all schemas**: 0 rows
- `information_schema.tables` search for `%activity%`: only `activity_stream` and `support_ticket_activity`. **No `activity_logs`** in any schema
- Preprod migration history: 906 applied, latest `20270929203000`. None in `supabase/migrations/` defines it
- Root cause (likely): the only definition is `docs/legacy-migrations/migrations/007_cashflow_pod_fields.sql`, a legacy file outside `supabase/migrations/`. The same file adds `trips.pod_status` / `invoice_status_1` / `invoice_no`, which are also absent on preprod (links to V1-4)
- Error handling:
  - `PodValidationView.tsx:276` does not read `{ error }` from the RPC. supabase-js returns errors rather than throwing, so the failure is **fully silent** and the user sees "POD validated successfully"
  - Both `logPods.service.ts` calls only `console.warn` and still return success
- Reachability:
  - `POD_VALIDATED`: POD Reconciliation → Validate
  - `POD_LOGGED` (bulk): `LogIncomingPodsModal` → `useMarkHardCopyPodsReceivedMutation`
  - `POD_LOGGED` (LR/attachments): `LogIncomingPodsScreen` → `useLogIncomingPodsMutation`

**Status: CONFIRMED (≥90%) on preprod. Elsewhere: NEEDS VERIFICATION** (prod not queried; the sibling repo is not available locally).

**Impact:**
- POD validation details (the deductions, remarks and the before/after `client_price`) are not persisted anywhere. Only the changed `client_price` remains.
- The hard-copy-received courier and tracking details are still captured by `record_trip_hard_copy_pod` in `trip_workflow_events`. The user-picked received date is not (see C2 in PLAN.md).
- Prod: unknown (not checked).

**Recommended owner / action:** the audit/platform owner (to be assigned; `packages/platform/` timeline is the sanctioned direction). Decide between restoring `log_activity`, repointing callers to an existing audit store, or removing the dead calls. Do **not** build a replacement inside Debit Control.
