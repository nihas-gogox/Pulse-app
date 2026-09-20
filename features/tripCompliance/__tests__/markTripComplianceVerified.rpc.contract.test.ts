import { readFileSync } from "fs";
import { join } from "path";
import {
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  REQUIRED_COMPLIANCE_DOCUMENT_TYPES,
} from "@/features/tripCompliance/tripCompliance.types";
import { canMarkComplianceVerified } from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";

const MIGRATION =
  "supabase/migrations/20270920140000_align_mark_trip_compliance_verified_required_types.sql";

function verified(type: string): ComplianceDocumentRow {
  return {
    id: type,
    trip_id: "trip-1",
    document_type: type,
    file_name: `${type}.pdf`,
    storage_path: type,
    uploaded_at: "2026-09-20",
    status: "verified",
    verified_by: "u1",
    verified_at: "2026-09-20",
    rejection_reason: null,
  };
}

describe("REQUIRED_COMPLIANCE_DOCUMENT_TYPES — product contract", () => {
  it("is LR, E-way Bill, and Invoice only", () => {
    expect([...REQUIRED_COMPLIANCE_DOCUMENT_TYPES].sort()).toEqual(["eway_bill", "invoice", "lr"]);
  });

  it("does not treat vehicle-vault insurance/RC as trip required types", () => {
    expect(REQUIRED_COMPLIANCE_DOCUMENT_TYPES).not.toContain("insurance");
    expect(REQUIRED_COMPLIANCE_DOCUMENT_TYPES).not.toContain("rc");
    expect(COMPLIANCE_VEHICLE_DOCUMENT_TYPES).toEqual(
      expect.arrayContaining(["insurance", "rc"]),
    );
  });
});

describe("mark_trip_compliance_verified RPC contract (aligned migration)", () => {
  const sql = readFileSync(join(process.cwd(), MIGRATION), "utf8");
  const requiredLine = sql.match(/v_required text\[] := array\[([^\]]+)\]/)?.[1] ?? "";

  it("replaces only the required trip-document list", () => {
    expect(requiredLine.replace(/\s/g, "")).toBe("'lr','invoice','eway_bill'");
    expect(requiredLine).not.toMatch(/insurance/);
    expect(requiredLine).not.toMatch(/'rc'/);
  });

  it("still requires verified status and still stamps compliance_verified_*", () => {
    expect(sql).toContain("and td.status = 'verified'");
    expect(sql).toContain("raise exception 'required documents not yet verified:");
    expect(sql).toContain("compliance_verified_by = v_uid");
    expect(sql).toContain("compliance_verified_at = now()");
    expect(sql).toContain("has_member_surface(v_org_id, 'trip_compliance.trip.mark_verified')");
    expect(sql).toContain("v_uid     uuid := auth.uid()");
  });

  it("does not change signature, vehicle vault, or payment objects", () => {
    expect(sql).toContain("mark_trip_compliance_verified(p_trip_id uuid)");
    expect(sql).not.toMatch(/entity_documents/);
    expect(sql).not.toMatch(/transactions/);
    expect(sql).not.toMatch(/deriveComplianceStage/);
  });
});

describe("client gate matches the aligned RPC set", () => {
  it("succeeds when LR, E-way Bill, and Invoice are verified without insurance/RC trip rows", () => {
    const result = canMarkComplianceVerified([
      verified("lr"),
      verified("invoice"),
      verified("eway_bill"),
    ]);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("fails when LR is missing", () => {
    expect(
      canMarkComplianceVerified([verified("invoice"), verified("eway_bill")]).missing,
    ).toContain("lr");
  });

  it("fails when E-way Bill is missing", () => {
    expect(
      canMarkComplianceVerified([verified("lr"), verified("invoice")]).missing,
    ).toContain("eway_bill");
  });

  it("fails when Invoice is missing", () => {
    expect(
      canMarkComplianceVerified([verified("lr"), verified("eway_bill")]).missing,
    ).toContain("invoice");
  });
});
