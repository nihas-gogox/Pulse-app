-- Phase 6 — close the P0 identified by Phase 5: compliance-approved-before-
-- advance and hard-copy-POD-received-before-balance were real business
-- rules (deriveComplianceQueueReadiness(), bulkRequirementBlockReason())
-- enforced only in the UI and, for the bulk-CSV path only, in a pre-check
-- that ran before — not inside — the actual write. A direct RPC/API call
-- bypassing the app's UI/bulk-validation step could post either payment for
-- an ineligible trip. This migration is the enforcement boundary chosen in
-- Step 3 of the Phase 6 instructions: extending the Phase 3 RESTRICTIVE RLS
-- pattern (20260921105432), not a second posting RPC.
--
-- Why RLS over a dedicated RPC (recorded per the Phase 6 instruction to
-- explain the choice):
--   - createLedgerEntry() already does substantial work per write (party
--     name resolution, trip-context resolution, amount capping, chat-mirror
--     side effects, client/supplier trip_workflow_events) that a new RPC
--     would have to either duplicate in SQL (a second ledger write path —
--     explicitly forbidden) or the service layer would have to call BOTH
--     the new RPC and createLedgerEntry(), which is not atomic and doesn't
--     actually close the gap.
--   - There are two write paths, not one: postCompliancePayment() (INSERT)
--     and updateCompliancePaymentUtr() (UPDATE, on an already-posted row).
--     A dedicated RPC would need to cover both, or the UPDATE path stays
--     unguarded — including the retag vector: updateLedgerEntry() could in
--     principle be called against an arbitrary existing transaction with
--     ledger_category='compliance_advance', converting a non-compliance row
--     into one without ever passing an eligibility check. RESTRICTIVE RLS
--     covers INSERT and UPDATE uniformly, for every current and future
--     caller, with zero TypeScript changes.
--   - Same "call a SECURITY DEFINER/STABLE-shaped check from inside RLS"
--     pattern the base transactions policy (is_org_member) and the Phase 3
--     policies (has_member_surface) already use — no new pattern invented.
--
-- Exception approval counts as approved: compliance_verified_at IS NOT NULL
-- is set by BOTH mark_trip_compliance_verified() (decision='approved') and
-- approve_trip_compliance_with_exception() (decision='approved_with_exception') —
-- checking compliance_verified_at alone, not compliance_decision, is
-- already exactly "approved OR approved_with_exception -> eligible" without
-- referencing the decision column at all.
--
-- Additive: two new RESTRICTIVE policies, nothing dropped or redefined.
-- Phase 3's policies (finance-surface requirement) are untouched and still
-- apply — RESTRICTIVE policies AND together, so both the finance-surface
-- grant AND this prerequisite are now required for a compliance ledger
-- write to succeed. Pure pass-through (AND'd with TRUE) for every
-- non-compliance ledger_category, exactly like Phase 3's policies — no
-- other Finance flow is affected.

create policy "compliance_advance_requires_compliance_approved"
  on public.transactions
  as restrictive
  for insert
  to authenticated
  with check (
    ledger_category is distinct from 'compliance_advance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.compliance_verified_at is not null
    )
  );

create policy "compliance_advance_requires_compliance_approved_on_update"
  on public.transactions
  as restrictive
  for update
  to authenticated
  using (
    ledger_category is distinct from 'compliance_advance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.compliance_verified_at is not null
    )
  )
  with check (
    ledger_category is distinct from 'compliance_advance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.compliance_verified_at is not null
    )
  );

create policy "compliance_balance_requires_pod_received"
  on public.transactions
  as restrictive
  for insert
  to authenticated
  with check (
    ledger_category is distinct from 'compliance_balance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.pod_received_at is not null
    )
  );

create policy "compliance_balance_requires_pod_received_on_update"
  on public.transactions
  as restrictive
  for update
  to authenticated
  using (
    ledger_category is distinct from 'compliance_balance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.pod_received_at is not null
    )
  )
  with check (
    ledger_category is distinct from 'compliance_balance'
    or exists (
      select 1 from public.trips t
       where t.id = transactions.trip_id
         and t.pod_received_at is not null
    )
  );
