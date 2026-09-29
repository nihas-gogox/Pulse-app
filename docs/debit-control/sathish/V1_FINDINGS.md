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

**Affected surface:**
- POD Reconciliation (`features/pod-reconciliation/services/podReconciliationService.ts:98` via `mergeTripsForPodOrg`)
- Invoicing (`features/invoicing/services/invoicing.service.ts:712`)

**Status:** confirmed from the definition on preprod. Exploitation was not attempted.

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

**Impact:**
- POD validation details (the deductions, remarks and the before/after `client_price`) are not persisted anywhere. Only the changed `client_price` remains.
- The hard-copy-received courier and tracking details are still captured by `record_trip_hard_copy_pod` in `trip_workflow_events`. The user-picked received date is not (see C2 in PLAN.md).
- Prod: unknown (not checked).

**Recommended owner / action:** the audit/platform owner (to be assigned; `packages/platform/` timeline is the sanctioned direction). Decide between restoring `log_activity`, repointing callers to an existing audit store, or removing the dead calls. Do **not** build a replacement inside Debit Control.
