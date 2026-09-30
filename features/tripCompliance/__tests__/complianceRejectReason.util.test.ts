import {
  COMPLIANCE_REJECT_REASON_OPTIONS,
  composeComplianceRejectReason,
} from "@/features/tripCompliance/utils/complianceRejectReason.util";

describe("composeComplianceRejectReason", () => {
  it("returns a single preset label", () => {
    expect(composeComplianceRejectReason(["memo_missing"], "")).toBe("Memo missing");
    expect(composeComplianceRejectReason(["truck_no_mismatch"], "ignored")).toBe(
      "Truck No mismatch",
    );
  });

  it("joins multiple presets in stable order", () => {
    expect(
      composeComplianceRejectReason(["vendor_rate_mismatch", "memo_missing"], ""),
    ).toBe("Memo missing; Vendor rate mismatch");
  });

  it("uses Other free text when Other is selected", () => {
    expect(composeComplianceRejectReason(["other"], "  Custom note  ")).toBe("Custom note");
    expect(composeComplianceRejectReason(["other"], "   ")).toBeNull();
    expect(
      composeComplianceRejectReason(["memo_missing", "other"], "Blurry scan"),
    ).toBe("Memo missing; Blurry scan");
  });

  it("returns null when nothing is selected", () => {
    expect(composeComplianceRejectReason([], "x")).toBeNull();
  });

  it("exposes the six product options", () => {
    expect(COMPLIANCE_REJECT_REASON_OPTIONS.map((o) => o.id)).toEqual([
      "memo_missing",
      "truck_no_mismatch",
      "vendor_mismatch",
      "client_date_mismatch",
      "vendor_rate_mismatch",
      "other",
    ]);
  });
});
