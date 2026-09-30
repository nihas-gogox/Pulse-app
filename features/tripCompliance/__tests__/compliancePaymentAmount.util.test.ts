import {
  COMPLIANCE_DEFAULT_ADVANCE_PERCENT,
  COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER,
  computeCompliancePaymentAmount,
  computeComplianceTdsAmount,
  resolveComplianceTdsRate,
} from "@/features/tripCompliance/utils/compliancePaymentAmount.util";

describe("computeCompliancePaymentAmount", () => {
  it("applies base freight × advance % minus charges", () => {
    expect(
      computeCompliancePaymentAmount({
        baseFreight: 24000,
        advancePercent: 90,
        documentationCharges: 0,
        tdsAmount: 0,
      }),
    ).toBe(21600);
  });

  it("subtracts documentation charges and TDS", () => {
    expect(
      computeCompliancePaymentAmount({
        baseFreight: 106500,
        advancePercent: 90,
        documentationCharges: 500,
        tdsAmount: 1000,
      }),
    ).toBe(94350);
  });

  it("clamps percent and never returns negative", () => {
    expect(
      computeCompliancePaymentAmount({
        baseFreight: 1000,
        advancePercent: 150,
        documentationCharges: 2000,
        tdsAmount: 0,
      }),
    ).toBe(0);
  });

  it("uses defaults for doc charges and advance", () => {
    expect(COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER).toBe(0);
    expect(COMPLIANCE_DEFAULT_ADVANCE_PERCENT).toBe(90);
  });
});

describe("computeComplianceTdsAmount", () => {
  it("computes base × TDS rate %", () => {
    expect(computeComplianceTdsAmount(10000, 2)).toBe(200);
    expect(computeComplianceTdsAmount(106500, 1)).toBe(1065);
  });

  it("returns 0 when rate or base is missing", () => {
    expect(computeComplianceTdsAmount(10000, null)).toBe(0);
    expect(computeComplianceTdsAmount(10000, 0)).toBe(0);
    expect(computeComplianceTdsAmount(0, 2)).toBe(0);
  });
});

describe("resolveComplianceTdsRate", () => {
  it("prefers the current financial year rate", () => {
    // Stub "now" via FY strings: Apr 2026 → FY 2026-27
    const asOf = new Date("2026-09-30T12:00:00+05:30");
    expect(
      resolveComplianceTdsRate(
        [
          { financial_year: "2025-26", rate_percent: 1 },
          { financial_year: "2026-27", rate_percent: 2 },
        ],
        asOf,
      ),
    ).toEqual({ financialYear: "2026-27", ratePercent: 2 });
  });

  it("falls back to the newest prior FY when current is missing", () => {
    const asOf = new Date("2026-09-30T12:00:00+05:30");
    expect(
      resolveComplianceTdsRate([{ financial_year: "2024-25", rate_percent: 1.5 }], asOf),
    ).toEqual({ financialYear: "2024-25", ratePercent: 1.5 });
  });

  it("returns null when no rates exist", () => {
    expect(resolveComplianceTdsRate([])).toBeNull();
  });
});
