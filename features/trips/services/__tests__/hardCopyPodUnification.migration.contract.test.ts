import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "supabase/migrations/20260921115001_hard_copy_pod_unification.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("record_trip_hard_copy_pod — Phase 4 unification contract", () => {
  it("is SECURITY DEFINER, enforcing trip_compliance.pod.manage server-side", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("has_member_surface(v_org_id, 'trip_compliance.pod.manage')");
  });

  it("makes courier/AWB/received-by optional (Trip Detail and Log Incoming PODs don't always have them)", () => {
    expect(sql).toContain("p_courier text default null");
    expect(sql).toContain("p_awb_number text default null");
    expect(sql).toContain("p_received_by text default null");
    expect(sql).not.toMatch(/raise exception 'courier, AWB number, and received-by are all required'/);
  });

  it("accepts an optional comment", () => {
    expect(sql).toContain("p_comment text default null");
  });

  it("stamps the pre-existing, pervasively-used pod_received_at — not just the courier/AWB columns", () => {
    expect(sql).toContain("pod_received_at = now()");
  });

  it("is idempotent: a trip that already has pod_received_at set returns false without overwriting anything", () => {
    expect(sql).toMatch(/if v_already_recv is not null then/);
    expect(sql).toContain("return false;");
    // The idempotent branch returns before the UPDATE and before the audit insert.
    const idempotentBranchIdx = sql.indexOf("if v_already_recv is not null then");
    const updateIdx = sql.indexOf("update public.trips");
    const auditIdx = sql.indexOf("insert into public.trip_workflow_events");
    expect(idempotentBranchIdx).toBeLessThan(updateIdx);
    expect(idempotentBranchIdx).toBeLessThan(auditIdx);
  });

  it("locks the row (for update) before checking already-received, protecting against concurrent duplicate transitions", () => {
    expect(sql).toMatch(/select organization_id, pod_received_at[\s\S]*for update;/);
  });

  it("writes exactly one canonical new audit/event type, reusing trip_workflow_events' idempotency_key pattern", () => {
    expect(sql).toContain("'pod.hard_copy_received'");
    expect(sql).toContain("p_trip_id::text || ':pod.hard_copy_received'");
    expect(sql).toContain("insert into public.trip_workflow_events");
    // Not inventing a second/duplicate event name for the same transition.
    expect(sql.match(/pod\.hard_copy_received/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).not.toMatch(/POD_RECEIVED|HARD_COPY_POD_RECEIVED|TRIP_POD_RECEIVED/);
  });

  it("swallows a concurrent duplicate-event unique_violation as a belt-and-suspenders guard, not the primary one", () => {
    expect(sql).toContain("exception when unique_violation then");
  });

  it("returns boolean (true = this call performed the transition) instead of void", () => {
    expect(sql).toContain("returns boolean");
    expect(sql).toContain("return true;");
  });

  it("drops and recreates rather than CREATE OR REPLACE, since the return type changes", () => {
    expect(sql).toContain("drop function if exists public.record_trip_hard_copy_pod(uuid, text, text, text);");
    expect(sql).toContain("create function public.record_trip_hard_copy_pod(");
  });

  it("grants execute to authenticated only, on the new 5-arg signature", () => {
    expect(sql).toContain(
      "grant execute on function public.record_trip_hard_copy_pod(uuid, text, text, text, text) to authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.record_trip_hard_copy_pod(uuid, text, text, text, text) from public",
    );
  });

  it("creates no new table, no new column, no second POD/settlement system", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/add column/i);
    expect(sql).not.toMatch(/payment_batch|compliance_decisions/i);
  });
});
