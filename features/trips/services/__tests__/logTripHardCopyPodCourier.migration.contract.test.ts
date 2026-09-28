import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION =
  "supabase/migrations/20270922174500_log_trip_hard_copy_pod_courier.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("log_trip_hard_copy_pod_courier — courier IN TRANSIT contract", () => {
  it("is SECURITY DEFINER and enforces trip_compliance.pod.manage", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain(
      "has_member_surface(v_org_id, 'trip_compliance.pod.manage')",
    );
  });

  it("does not stamp pod_received_at (keeps status IN TRANSIT)", () => {
    expect(sql).not.toMatch(/pod_received_at\s*=\s*now\(\)/);
    expect(sql).toContain("pod_hard_copy_courier = v_courier");
    expect(sql).toContain("pod_hard_copy_awb_number = v_awb");
  });

  it("requires courier, AWB, and dispatch date", () => {
    expect(sql).toContain("raise exception 'courier name is required'");
    expect(sql).toContain(
      "raise exception 'tracking / AWB number is required'",
    );
    expect(sql).toContain("raise exception 'dispatch date is required'");
  });

  it("no-ops when hard-copy POD is already received", () => {
    expect(sql).toMatch(/if v_already is not null then/);
    expect(sql).toContain("return false;");
  });

  it("writes pod.hard_copy_courier_dispatched into trip_workflow_events", () => {
    expect(sql).toContain("'pod.hard_copy_courier_dispatched'");
    expect(sql).toContain(
      "p_trip_id::text || ':pod.hard_copy_courier_dispatched'",
    );
  });

  it("creates no new table or trips columns", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/add column/i);
  });
});
