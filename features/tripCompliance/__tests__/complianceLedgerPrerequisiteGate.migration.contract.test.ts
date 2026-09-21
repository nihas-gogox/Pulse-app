import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "supabase/migrations/20260921125437_compliance_ledger_prerequisite_gate.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("Phase 6 — compliance ledger prerequisite gate (the P0 fix)", () => {
  it("is purely additive: no DROP, no ALTER, no existing policy touched", () => {
    expect(sql).not.toMatch(/drop policy|drop function|drop table|alter table/i);
    expect(sql).not.toMatch(/create or replace/i);
  });

  it("adds exactly 4 new RESTRICTIVE policies (insert+update for each category)", () => {
    const matches = sql.match(/as restrictive/gi) ?? [];
    expect(matches.length).toBe(4);
    expect(sql).toContain('create policy "compliance_advance_requires_compliance_approved"');
    expect(sql).toContain('create policy "compliance_advance_requires_compliance_approved_on_update"');
    expect(sql).toContain('create policy "compliance_balance_requires_pod_received"');
    expect(sql).toContain('create policy "compliance_balance_requires_pod_received_on_update"');
  });

  it("advance requires compliance_verified_at IS NOT NULL — NOT compliance_decision = 'approved'", () => {
    expect(sql).toMatch(/t\.compliance_verified_at is not null/);
    // Exception approval must count: the policy bodies never reference
    // compliance_decision (only the header comment explains why, in prose) —
    // compliance_verified_at is set by both the normal and the
    // exception-approval RPC, so checking it alone is already correct.
    expect(sql).not.toMatch(/compliance_decision\s*[=<>]/);
    expect(sql).not.toMatch(/and compliance_decision/i);
  });

  it("balance requires pod_received_at IS NOT NULL — never courier/AWB/received_by/pod_status", () => {
    expect(sql).toMatch(/t\.pod_received_at is not null/);
    expect(sql).not.toMatch(/pod_hard_copy_courier|pod_hard_copy_awb_number|pod_hard_copy_received_by|pod_status/);
  });

  it("is a pure pass-through for every non-compliance ledger_category (never touches other Finance flows)", () => {
    // 1 INSERT policy + 1 UPDATE policy's USING + that UPDATE policy's WITH CHECK = 3.
    expect(sql.match(/ledger_category is distinct from 'compliance_advance'/g)?.length).toBe(3);
    expect(sql.match(/ledger_category is distinct from 'compliance_balance'/g)?.length).toBe(3);
  });

  it("covers both INSERT and UPDATE (closes the retag-via-updateLedgerEntry vector)", () => {
    expect(sql).toMatch(/for insert/i);
    expect(sql).toMatch(/for update/i);
    // UPDATE policies must have both USING and WITH CHECK, matching the
    // Phase 3 pattern, so the retag vector is closed on both read and write.
    const updateBlocks = sql.split(/for update/i).slice(1);
    for (const block of updateBlocks) {
      const beforeNextPolicy = block.split(/create policy/i)[0];
      expect(beforeNextPolicy).toMatch(/using \(/);
      expect(beforeNextPolicy).toMatch(/with check \(/);
    }
  });

  it("scopes to authenticated only, matching the Phase 3 pattern", () => {
    expect(sql.match(/to authenticated/g)?.length).toBe(4);
  });

  it("creates no new table, column, ledger, or settlement state machine", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/add column/i);
    expect(sql).not.toMatch(/payment_batch|compliance_decisions|settlement_stage/i);
  });
});
