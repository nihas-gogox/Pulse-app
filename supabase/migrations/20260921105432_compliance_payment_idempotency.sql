-- Compliance Advance/Balance payment hardening — Phase 3 of the Compliance /
-- Advance / Hard-Copy POD / Balance / Settlement workflow.
--
-- Per Phase 3 discovery: the existing "at most one advance + one balance
-- payment per trip" rule (evaluateCompliancePaymentGuard() in
-- compliancePaymentGuard.util.ts) is enforced only in application code — a
-- SELECT immediately before the INSERT, which two concurrent requests can
-- both pass. This file promotes that already-existing business rule into a
-- real database constraint. It does not create a second ledger, a new
-- payment system, or a new settlement state machine.
--
-- ============================================================================
-- REQUIRED BEFORE THIS MIGRATION IS EVER APPLIED
-- ============================================================================
-- This repo's production DB is under a standing schema freeze (see
-- docs/DB_PERFORMANCE_HARDENING_CHECKLIST.md) and this session has no live
-- DB access to run it. Before `db:push`, run this audit against the real
-- database — if it returns any rows, the unique index below will fail to
-- create and those duplicates must be reconciled first:
--
--   select trip_id, ledger_category, count(*)
--     from public.transactions
--    where ledger_category in ('compliance_advance', 'compliance_balance')
--    group by trip_id, ledger_category
--   having count(*) > 1;
--
-- ============================================================================

-- ── 1. Structured payment reference ─────────────────────────────────────────
-- Today the UTR/payment reference lives only inside the free-text
-- `description` column (parsed via parsePaymentReference() in
-- finance.service.ts). That is not a safe identity to build duplicate
-- detection on (Phase 3 Section 4). This is additive and nullable — no
-- backfill of historical rows; callers fall back to the existing text parser
-- for rows written before this column existed.

alter table public.transactions
  add column if not exists payment_reference text;

comment on column public.transactions.payment_reference is
  'Structured payment reference/UTR. Populated by createLedgerEntry()/updateLedgerEntry() going forward (explicit value, or derived from description via the existing parsePaymentReference() for backward compatibility). Historical rows are NULL — callers must fall back to text-parsing for those.';

-- ── 2. DB-level duplicate-advance/duplicate-balance protection ─────────────
-- Formalizes evaluateCompliancePaymentGuard()'s existing rule: at most one
-- compliance_advance and one compliance_balance transaction per trip, ever.
-- This is the actual fix for Phase 3 Sections 3/9/10/21 (idempotent retry,
-- concurrent duplicate posting) — no new identifier needed, trip_id +
-- ledger_category (both existing columns) is the safe existing combination
-- the discovery step was asked to look for.

create unique index if not exists ux_transactions_compliance_trip_category
  on public.transactions (trip_id, ledger_category)
  where trip_id is not null
    and ledger_category in ('compliance_advance', 'compliance_balance');

comment on index public.ux_transactions_compliance_trip_category is
  'At most one compliance_advance and one compliance_balance transaction per trip. A second concurrent/retried post fails with 23505 — callers (postCompliancePayment) translate that into "already processed" rather than a raw DB error.';

-- ── 3. Server-side authorization for compliance ledger writes ─────────────
-- Today ANY active org member can INSERT/UPDATE any transactions row (the
-- base "Org members can manage transactions" policy from the initial
-- schema) — trip_compliance.finance.manage is enforced client-side only
-- (Phase 3 Section 14). These RESTRICTIVE policies close that gap narrowly:
-- they only add a requirement for the two compliance ledger_category values
-- and are a pure pass-through (AND'd with TRUE) for every other transaction,
-- so no other Finance flow is affected. Same has_member_surface() pattern
-- already used by every compliance RPC, and the same "call a SECURITY
-- DEFINER STABLE helper from inside a policy clause" pattern the base
-- transactions policy already uses via is_org_member().

create policy "compliance_transactions_insert_requires_finance_surface"
  on public.transactions
  as restrictive
  for insert
  to authenticated
  with check (
    (ledger_category is distinct from 'compliance_advance'
      and ledger_category is distinct from 'compliance_balance')
    or public.has_member_surface(organization_id, 'trip_compliance.finance.manage')
  );

create policy "compliance_transactions_update_requires_finance_surface"
  on public.transactions
  as restrictive
  for update
  to authenticated
  using (
    (ledger_category is distinct from 'compliance_advance'
      and ledger_category is distinct from 'compliance_balance')
    or public.has_member_surface(organization_id, 'trip_compliance.finance.manage')
  )
  with check (
    (ledger_category is distinct from 'compliance_advance'
      and ledger_category is distinct from 'compliance_balance')
    or public.has_member_surface(organization_id, 'trip_compliance.finance.manage')
  );
