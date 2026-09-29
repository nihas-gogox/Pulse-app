/**
 * Static contract for the decline migration (CONTRACT.md §2.D, MIGRATION.md,
 * AC-30..AC-32, AC-35, AC-36). Not a DB test — the migration is not applied.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20270929162901_trip_compliance_decline.sql";
const raw = readFileSync(join(DIR, FILE), "utf8");
// Strip line comments so assertions only see executable SQL.
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const fnBody = sql.slice(sql.indexOf("create or replace function public.decline_trip_compliance"));

describe("decline migration — filename / ordering", () => {
  it("has a non-000000 time component (no pulse-unified-base collision)", () => {
    expect(FILE).toMatch(/^\d{14}_/);
    expect(FILE.slice(8, 14)).not.toBe("000000");
  });

  it("sorts after every other migration file (no --include-all needed)", () => {
    const versions = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(versions[versions.length - 1]).toBe(FILE);
  });

  it("is not an empty file (db:preflight rule)", () => {
    expect(sql.trim().length).toBeGreaterThan(100);
  });
});

describe("decline migration — columns and constraint", () => {
  it("adds three nullable columns, no default, no backfill", () => {
    expect(sql).toMatch(/add column if not exists compliance_declined_at timestamptz,/);
    expect(sql).toMatch(/add column if not exists compliance_declined_by uuid references auth\.users\(id\),/);
    expect(sql).toMatch(/add column if not exists compliance_decline_reason text;/);
    expect(sql).not.toMatch(/compliance_decline\w*[^;]*\bdefault\b/i);
    expect(sql).not.toMatch(/compliance_decline\w* (timestamptz|uuid|text)[^,;]*not null/i);
    // The only UPDATE is the one inside the RPC body (no backfill).
    expect((sql.match(/update public\.trips/g) ?? []).length).toBe(1);
    expect(sql.indexOf("update public.trips")).toBeGreaterThan(sql.indexOf("create or replace function"));
  });

  it("reason check is NOT VALID then validated separately", () => {
    expect(sql).toMatch(/add constraint trips_compliance_decline_reason_length_check[\s\S]*?between 3 and 500[\s\S]*?\) not valid;/);
    expect(sql).toMatch(/validate constraint trips_compliance_decline_reason_length_check;/);
    expect(sql.indexOf("not valid;")).toBeLessThan(sql.indexOf("validate constraint"));
  });

  it("does not redefine the existing verify / exception RPCs (AC-35)", () => {
    expect(sql).not.toMatch(/function public\.mark_trip_compliance_verified/);
    expect(sql).not.toMatch(/function public\.approve_trip_compliance_with_exception/);
    expect((sql.match(/create (or replace )?function/gi) ?? []).length).toBe(1);
  });
});

describe("decline_trip_compliance — definition", () => {
  it("is SECURITY DEFINER with a pinned search_path", () => {
    expect(fnBody).toMatch(/security definer/);
    expect(fnBody).toMatch(/set search_path = public/);
  });

  it("signature matches the client call (p_trip_id, p_reason, p_idempotency_key default null)", () => {
    expect(fnBody).toMatch(/p_trip_id uuid,\s*p_reason text,\s*p_idempotency_key text default null/);
  });

  it("gates on the mark_verified surface via has_member_surface, one message for missing/foreign trips", () => {
    expect(fnBody).toContain("public.has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified')");
    expect(fnBody).toMatch(/if v_org_id is null\s+or not public\.has_member_surface/);
    expect(fnBody).toContain("raise exception 'not authorized to decline compliance for this trip'");
    expect(raw).not.toMatch(/trip not found/i);
  });

  it("permission check precedes the row lock; lock precedes the verified guard and every write", () => {
    const perm = fnBody.indexOf("has_member_surface");
    const lock = fnBody.search(/from public\.trips\s+where id = p_trip_id\s+for update/);
    const verifiedGuard = fnBody.search(/if v_verified_at is not null then/);
    const firstInsert = fnBody.indexOf("insert into public.trip_workflow_events");
    const update = fnBody.indexOf("update public.trips");
    expect(perm).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(perm);
    expect(verifiedGuard).toBeGreaterThan(lock);
    expect(firstInsert).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(lock);
    // The pre-auth read must not lock.
    const preAuth = fnBody.slice(0, perm);
    expect(preAuth).not.toMatch(/for update/);
    expect((fnBody.match(/for update/g) ?? []).length).toBe(1);
  });

  it("rejects already-verified trips and out-of-range trimmed reasons before writing", () => {
    const firstWrite = fnBody.indexOf("insert into public.trip_workflow_events");
    const verifiedGuard = fnBody.search(/if v_verified_at is not null then\s+raise exception/);
    const reasonGuard = fnBody.search(/char_length\(v_reason\) < 3 or char_length\(v_reason\) > 500/);
    expect(fnBody).toMatch(/v_reason\s+text := trim\(p_reason\)/);
    expect(verifiedGuard).toBeGreaterThan(-1);
    expect(reasonGuard).toBeGreaterThan(-1);
    expect(verifiedGuard).toBeLessThan(firstWrite);
    expect(reasonGuard).toBeLessThan(firstWrite);
  });

  it("idempotency: keyed event inserted first; unique_violation returns before the trips update", () => {
    const keyedInsert = fnBody.indexOf("':compliance.declined:' || v_key");
    const uniqueViolation = fnBody.search(/exception when unique_violation then\s+return;/);
    const update = fnBody.indexOf("update public.trips");
    expect(keyedInsert).toBeGreaterThan(-1);
    expect(uniqueViolation).toBeGreaterThan(keyedInsert);
    expect(update).toBeGreaterThan(uniqueViolation);
  });

  it("audits compliance.declined with {reason, previous_reason}", () => {
    expect(fnBody).toMatch(/'reason', v_reason,\s*'previous_reason', v_previous_reason/);
    expect((fnBody.match(/'compliance\.declined'/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("writes only the decline columns on trips (never verified/decision)", () => {
    const update = fnBody.slice(fnBody.indexOf("update public.trips"), fnBody.lastIndexOf("end;"));
    expect(update).toMatch(/compliance_declined_at = now\(\)/);
    expect(update).toMatch(/compliance_declined_by = v_uid/);
    expect(update).toMatch(/compliance_decline_reason = v_reason/);
    expect(update).not.toMatch(/compliance_verified|compliance_decision/);
  });
});

describe("decline_trip_compliance — grants (AC-36)", () => {
  const SIG = "public.decline_trip_compliance(uuid, text, text)";
  it("grants execute to authenticated", () => {
    expect(sql).toContain(`grant execute on function ${SIG} to authenticated;`);
  });
  it("revokes from public and anon", () => {
    expect(sql).toContain(`revoke all on function ${SIG} from public;`);
    expect(sql).toContain(`revoke all on function ${SIG} from anon;`);
  });
  it("never grants to anon or service-wide public", () => {
    expect(sql).not.toMatch(/grant [^;]* to (anon|public)\b/);
  });
});
