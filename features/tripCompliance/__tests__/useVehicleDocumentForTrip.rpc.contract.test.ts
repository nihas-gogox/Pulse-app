import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = "supabase/migrations/20260921144726_use_vehicle_document_for_trip.sql";
const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");

describe("use_vehicle_document_for_trip RPC contract", () => {
  it("is SECURITY DEFINER, gated by the same surface as trip document verification", () => {
    expect(sql).toContain("create or replace function public.use_vehicle_document_for_trip(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("has_member_surface(v_org_id, 'trip_compliance.documents.verify')");
  });

  it("only accepts rc/insurance — the only vehicle types trip_documents' CHECK constraint allows", () => {
    expect(sql).toMatch(/if p_document_type not in \('rc', 'insurance'\) then/);
  });

  it("requires the trip to have an assigned vehicle", () => {
    expect(sql).toContain("raise exception 'trip has no assigned vehicle'");
  });

  it("validates org match, vehicle match, doc-type match, verified status, and expiry — all server-side", () => {
    expect(sql).toContain("raise exception 'vehicle document belongs to a different workspace'");
    expect(sql).toContain("raise exception 'vehicle document does not belong to this trip''s assigned vehicle'");
    expect(sql).toMatch(/raise exception 'vehicle document type \(%\) does not match/);
    expect(sql).toContain("raise exception 'vehicle document is not eligible for reuse (status: %)'");
    expect(sql).toContain("raise exception 'vehicle document is expired (expiry date: %)'");
  });

  it("is idempotent: reusing the exact same version for the same trip/type is a no-op", () => {
    expect(sql).toMatch(/v_existing_id is not null and v_existing_src = p_entity_document_id/);
    expect(sql).toContain("'already_attached', true");
  });

  it("replaces (not duplicates) an existing row when a different version is chosen", () => {
    expect(sql).toMatch(/if v_existing_id is not null then\s*\n\s*update public\.trip_documents/);
    expect(sql).toContain("v_action := 'replaced'");
  });

  it("never writes a real trip-documents-bucket path — uses a synthetic per-trip/type/doc reference marker", () => {
    expect(sql).toContain("v_ref_path := 'ref:vehicle-document:'");
  });

  it("writes document_audit_log with source=workspace_vehicle_document metadata, not a new audit table", () => {
    expect(sql).toContain("insert into public.document_audit_log");
    expect(sql).toContain("'source', 'workspace_vehicle_document'");
    expect(sql).toContain("'action_detail', 'reused'");
  });

  it("writes a distinct, idempotent trip_workflow_events row per (trip, type, source document)", () => {
    expect(sql).toContain("'compliance.vehicle_document_reused'");
    expect(sql).toContain(
      "p_trip_id::text || ':compliance.vehicle_document_reused:' || p_document_type || ':' || p_entity_document_id::text",
    );
    expect(sql).toContain("exception when unique_violation then");
  });

  it("grants execute to authenticated only", () => {
    expect(sql).toContain(
      "grant execute on function public.use_vehicle_document_for_trip(uuid, uuid, text) to authenticated",
    );
    expect(sql).toContain(
      "revoke all on function public.use_vehicle_document_for_trip(uuid, uuid, text) from public",
    );
  });

  it("does not create a new table, widen an existing enum, or duplicate storage", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/drop constraint.*document_type_check/i);
    expect(sql).not.toMatch(/storage\.(upload|copy)/i);
  });

  it("adds exactly one additive, indexed FK column to trip_documents", () => {
    expect(sql).toContain(
      "add column if not exists source_entity_document_id uuid\n    references public.entity_documents(id) on delete set null",
    );
    expect(sql).toContain("create index if not exists idx_trip_documents_source_entity_document_id");
  });
});
