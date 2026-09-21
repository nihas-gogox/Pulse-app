import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "supabase/migrations/20260921102615_approve_trip_compliance_with_exception.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("approve_trip_compliance_with_exception RPC contract", () => {
  it("is SECURITY DEFINER, gated by the same surface as normal approval", () => {
    expect(sql).toContain("create or replace function public.approve_trip_compliance_with_exception(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified')");
  });

  it("requires a non-empty comment before touching any row", () => {
    expect(sql).toMatch(/if coalesce\(v_comment, ''\) = '' then\s*\n\s*raise exception 'a comment is required/);
  });

  it("re-derives the required document types server-side (lr, invoice, eway_bill)", () => {
    expect(sql).toMatch(/v_required\s+text\[\]\s*:=\s*array\['lr', 'invoice', 'eway_bill'\]/);
  });

  it("blocks downgrading an already-normally-approved trip to an exception", () => {
    expect(sql).toContain("cannot downgrade to an exception approval");
  });

  it("is idempotent on retry of the same exception decision", () => {
    expect(sql).toMatch(/already approved_with_exception.*no-op/i);
    expect(sql).toContain("exception when unique_violation then");
  });

  it("stamps the decision, reason, and outstanding summary, and reuses compliance_verified_by/at", () => {
    expect(sql).toContain("compliance_decision = 'approved_with_exception'");
    expect(sql).toContain("compliance_exception_reason = v_comment");
    expect(sql).toContain("compliance_outstanding_summary = v_outstanding");
    expect(sql).toContain("compliance_verified_by = v_uid");
    expect(sql).toContain("compliance_verified_at = now()");
  });

  it("writes an immutable trip_workflow_events row with a deterministic idempotency key", () => {
    expect(sql).toContain("'compliance.approved_with_exception'");
    expect(sql).toContain("p_trip_id::text || ':compliance.approved_with_exception'");
    expect(sql).toContain("insert into public.trip_workflow_events");
  });

  it("grants execute to authenticated only", () => {
    expect(sql).toContain("grant execute on function public.approve_trip_compliance_with_exception(uuid, text) to authenticated");
    expect(sql).toContain("revoke all on function public.approve_trip_compliance_with_exception(uuid, text) from public");
  });

  it("does not create a new table or duplicate ComplianceStage", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/compliance_decisions/);
  });
});

describe("mark_trip_compliance_verified — unchanged gate, now also stamps the decision", () => {
  it("still requires the same lr/invoice/eway_bill set and the same surface grant", () => {
    expect(sql).toMatch(/v_required text\[\] := array\['lr', 'invoice', 'eway_bill'\]/);
    expect(sql).toContain("has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified')");
    expect(sql).toContain("raise exception 'required documents not yet verified:");
  });

  it("stamps compliance_decision = 'approved' and clears any prior exception markers", () => {
    expect(sql).toContain("compliance_decision = 'approved',");
    expect(sql).toContain("compliance_exception_reason = null,");
    expect(sql).toContain("compliance_outstanding_summary = null");
  });
});

describe("trips.compliance_decision persistence — reuses existing columns, no redundant pair", () => {
  it("adds exactly 3 new columns, reusing compliance_verified_by/at as the decision actor/timestamp", () => {
    expect(sql).toContain("add column if not exists compliance_decision text");
    expect(sql).toContain("add column if not exists compliance_exception_reason text");
    expect(sql).toContain("add column if not exists compliance_outstanding_summary jsonb");
    expect(sql).not.toMatch(/add column if not exists compliance_decision_at/);
    expect(sql).not.toMatch(/add column if not exists compliance_decision_by/);
  });

  it("constrains compliance_decision to the two known values", () => {
    expect(sql).toMatch(/check \(compliance_decision in \('approved', 'approved_with_exception'\)\)/);
  });
});
