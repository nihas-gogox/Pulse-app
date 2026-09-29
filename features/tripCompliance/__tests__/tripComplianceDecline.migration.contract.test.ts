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
const fnStart = sql.indexOf("create or replace function public.decline_trip_compliance");
// Decline RPC only: from its create to its grant (the guard trigger fn follows).
const fnBody = sql.slice(fnStart, sql.indexOf("grant execute on function public.decline_trip_compliance"));
const guardStart = sql.indexOf("create or replace function public.guard_trip_compliance_decline_columns()");
const guardBody = sql.slice(guardStart, sql.indexOf("$$;", guardStart) + 3);

describe("decline migration — filename / ordering", () => {
  it("has a non-000000 time component (no pulse-unified-base collision)", () => {
    expect(FILE).toMatch(/^\d{14}_/);
    expect(FILE.slice(8, 14)).not.toBe("000000");
  });

  it("sorts directly after the release remote head (no --include-all needed)", () => {
    // CONTRACT.md D4 / MIGRATION.md: remote head at release was 20270928114500.
    // Later migrations may follow decline; none may be inserted between the
    // release head and decline (that file would sort before an applied migration).
    const RELEASE_REMOTE_HEAD = "20270928114500_client_contract_validity.sql";
    const versions = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const i = versions.indexOf(FILE);
    expect(i).toBeGreaterThan(0);
    expect(versions[i - 1]).toBe(RELEASE_REMOTE_HEAD);
  });

  it("sets a local lock_timeout before any DDL", () => {
    const lt = sql.indexOf("set local lock_timeout = '5s';");
    expect(lt).toBeGreaterThan(-1);
    expect(lt).toBeLessThan(sql.indexOf("alter table"));
  });

  it("is not an empty file (db:preflight rule)", () => {
    expect(sql.trim().length).toBeGreaterThan(100);
  });
});

describe("decline migration — columns and constraint", () => {
  it("adds three nullable columns, no default, no backfill", () => {
    expect(sql).toMatch(/add column if not exists compliance_declined_at timestamptz,/);
    expect(sql).toMatch(/add column if not exists compliance_declined_by uuid references auth\.users\(id\) on delete set null,/);
    expect(sql).toMatch(/add column if not exists compliance_decline_reason text;/);
    expect(sql).not.toMatch(/compliance_decline\w*[^;]*\bdefault\b/i);
    expect(sql).not.toMatch(/compliance_decline\w* (timestamptz|uuid|text)[^,;]*not null/i);
    // The only UPDATE is the one inside the RPC body (no backfill).
    expect((sql.match(/update public\.trips/g) ?? []).length).toBe(1);
    expect(sql.indexOf("update public.trips")).toBeGreaterThan(fnStart);
    expect(sql.indexOf("update public.trips")).toBeLessThan(fnStart + fnBody.length);
  });

  it("reason check is NOT VALID then validated separately", () => {
    expect(sql).toMatch(/add constraint trips_compliance_decline_reason_length_check[\s\S]*?between 3 and 500[\s\S]*?\) not valid;/);
    expect(sql).toMatch(/validate constraint trips_compliance_decline_reason_length_check;/);
    expect(sql.indexOf("not valid;")).toBeLessThan(sql.indexOf("validate constraint"));
  });

  it("does not redefine the existing verify / exception RPCs (AC-35)", () => {
    expect(sql).not.toMatch(/function public\.mark_trip_compliance_verified/);
    expect(sql).not.toMatch(/function public\.approve_trip_compliance_with_exception/);
    const created = [...sql.matchAll(/create (?:or replace )?function\s+([\w.]+)\s*\(/gi)].map((m) => m[1]);
    expect(created.sort()).toEqual(["public.decline_trip_compliance", "public.guard_trip_compliance_decline_columns"]);
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
    const lock = fnBody.search(/from public\.trips\s+where id = p_trip_id\s+and organization_id = v_org_id\s+for update/);
    const verifiedGuard = fnBody.search(/if v_verified_at is not null then/);
    const firstInsert = fnBody.indexOf("insert into public.trip_workflow_events");
    const update = fnBody.indexOf("update public.trips");
    expect(perm).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(perm);
    expect(verifiedGuard).toBeGreaterThan(lock);
    expect(firstInsert).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(lock);
    // Unlocked org read comes first and must not lock.
    const orgRead = fnBody.search(/select organization_id into v_org_id from public\.trips where id = p_trip_id;/);
    expect(orgRead).toBeGreaterThan(-1);
    expect(orgRead).toBeLessThan(perm);
    expect(fnBody.slice(0, perm)).not.toMatch(/for update/);
    // Lost race (trip moved org) → same not-authorized error, before the verified guard.
    const notFound = fnBody.search(/if not found then\s+raise exception 'not authorized to decline compliance for this trip'/);
    expect(notFound).toBeGreaterThan(lock);
    expect(notFound).toBeLessThan(verifiedGuard);
    expect((fnBody.match(/for update/g) ?? []).length).toBe(1);
  });

  it("rejects already-verified trips and out-of-range trimmed reasons before writing", () => {
    const firstWrite = fnBody.indexOf("insert into public.trip_workflow_events");
    const verifiedGuard = fnBody.search(/if v_verified_at is not null then\s+raise exception/);
    const reasonGuard = fnBody.search(/char_length\(v_reason\) < 3 or char_length\(v_reason\) > 500/);
    expect(fnBody).toContain("v_reason          text := regexp_replace(coalesce(p_reason, ''), '^\\s+|\\s+$', '', 'g');");
    expect(fnBody).toMatch(/if char_length\(v_reason\) < 3 or char_length\(v_reason\) > 500 then/);
    expect(fnBody).not.toMatch(/v_reason is null/);
    expect(reasonGuard).toBeGreaterThan(verifiedGuard);
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
    expect(update.length).toBeGreaterThan(0);
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

describe("guard_trip_compliance_decline_columns — direct-UPDATE guard", () => {
  it("is an invoker (not security definer) trigger fn with pinned search_path", () => {
    expect(guardStart).toBeGreaterThan(-1);
    expect(guardBody).toMatch(/returns trigger/);
    expect(guardBody).toMatch(/set search_path = public/);
    expect(guardBody).not.toMatch(/security definer/);
  });

  it("raises 42501 for authenticated/anon when any decline column changes", () => {
    expect(guardBody).toMatch(/current_user in \('authenticated', 'anon'\)/);
    for (const col of ["compliance_declined_at", "compliance_declined_by", "compliance_decline_reason"]) {
      expect(guardBody).toMatch(new RegExp(`new\\.${col}\\s+is distinct from old\\.${col}`));
    }
    expect(guardBody).toMatch(/raise exception 'compliance decline fields can only be changed[^']*'\s+using errcode = '42501'/);
    expect(guardBody).toMatch(/return new;/);
  });

  it("revokes EXECUTE from public, anon and authenticated", () => {
    const SIG = "public.guard_trip_compliance_decline_columns()";
    for (const role of ["public", "anon", "authenticated"]) {
      expect(sql).toContain(`revoke all on function ${SIG} from ${role};`);
    }
  });

  it("drops then creates a BEFORE UPDATE OF <3 decline columns> row trigger on trips", () => {
    const drop = sql.indexOf("drop trigger if exists trg_guard_trip_compliance_decline_columns on public.trips;");
    const create = sql.search(
      /create trigger trg_guard_trip_compliance_decline_columns\s+before update of compliance_declined_at, compliance_declined_by, compliance_decline_reason\s+on public\.trips\s+for each row execute function public\.guard_trip_compliance_decline_columns\(\);/,
    );
    expect(drop).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(drop);
    expect(create).toBeGreaterThan(guardStart);
  });
});
