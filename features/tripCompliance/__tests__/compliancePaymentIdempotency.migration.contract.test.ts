import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "supabase/migrations/20260921105432_compliance_payment_idempotency.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("compliance payment idempotency migration — additive only", () => {
  it("adds payment_reference as a nullable column, no backfill", () => {
    expect(sql).toContain("add column if not exists payment_reference text");
    expect(sql).not.toMatch(/^\s*update public\.transactions/im);
  });

  it("creates no new table (reuses transactions)", () => {
    expect(sql).not.toMatch(/create table/i);
  });

  it("includes the required pre-flight duplicate-audit query in its header", () => {
    expect(sql).toMatch(/group by trip_id, ledger_category/i);
    expect(sql).toMatch(/having count\(\*\) > 1/i);
  });
});

describe("ux_transactions_compliance_trip_category — the idempotency/concurrency fix", () => {
  it("is a partial unique index scoped to compliance_advance/compliance_balance only", () => {
    expect(sql).toContain("create unique index if not exists ux_transactions_compliance_trip_category");
    expect(sql).toContain("on public.transactions (trip_id, ledger_category)");
    expect(sql).toMatch(/where trip_id is not null\s*\n\s*and ledger_category in \('compliance_advance', 'compliance_balance'\)/);
  });
});

describe("compliance transactions RESTRICTIVE RLS policies", () => {
  it("gates INSERT and UPDATE of compliance rows on the existing finance-manage surface", () => {
    expect(sql).toContain("compliance_transactions_insert_requires_finance_surface");
    expect(sql).toContain("compliance_transactions_update_requires_finance_surface");
    expect(sql).toContain("as restrictive");
    expect(sql).toContain("has_member_surface(organization_id, 'trip_compliance.finance.manage')");
  });

  it("is a pure pass-through for every other ledger_category (never blocks unrelated Finance flows)", () => {
    expect(sql).toMatch(/ledger_category is distinct from 'compliance_advance'\s*\n\s*and ledger_category is distinct from 'compliance_balance'\)\s*\n\s*or public\.has_member_surface/);
  });

  it("does not create a new RBAC system — reuses has_member_surface", () => {
    const createFunctionCount = (sql.match(/create (or replace )?function/gi) ?? []).length;
    expect(createFunctionCount).toBe(0);
  });
});
