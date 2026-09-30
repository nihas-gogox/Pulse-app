import { financialYearOf } from "@/features/suppliers/utils/supplierVendorOnboarding.util";

/**
 * Compliance Confirm payment amount:
 * (Base freight × Advance %) − documentation charges − TDS
 *
 * TDS amount = Base freight × supplier TDS rate % for the current financial year
 * (vendor vault → supplier_tds_rates). Documentation charges stay 0 until wired.
 */
export function computeCompliancePaymentAmount(input: {
  baseFreight: number;
  advancePercent: number;
  documentationCharges?: number | null;
  tdsAmount?: number | null;
}): number {
  const base = Number(input.baseFreight);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const pctRaw = Number(input.advancePercent);
  const pct = Number.isFinite(pctRaw) ? Math.min(100, Math.max(0, pctRaw)) : 0;
  const doc = Math.max(0, Number(input.documentationCharges) || 0);
  const tds = Math.max(0, Number(input.tdsAmount) || 0);
  const raw = base * (pct / 100) - doc - tds;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 100) / 100;
}

/** TDS rupees from base freight × rate % (Section 194C-style). */
export function computeComplianceTdsAmount(
  baseFreight: number,
  tdsRatePercent: number | null | undefined,
): number {
  const base = Number(baseFreight);
  const rate = Number(tdsRatePercent);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, rate));
  return Math.round(base * (clamped / 100) * 100) / 100;
}

export type ComplianceTdsRateRow = {
  financial_year: string;
  rate_percent: number;
};

/**
 * Prefer the rate saved for the Indian FY of `asOf` (Apr–Mar).
 * Falls back to the newest prior FY when the current year has no row.
 */
export function resolveComplianceTdsRate(
  rates: ComplianceTdsRateRow[],
  asOf: Date = new Date(),
): { financialYear: string; ratePercent: number } | null {
  if (!rates.length) return null;
  const fy = financialYearOf(asOf);
  const exact = rates.find((r) => r.financial_year === fy);
  if (exact && Number.isFinite(Number(exact.rate_percent))) {
    return { financialYear: exact.financial_year, ratePercent: Number(exact.rate_percent) };
  }
  const prior = [...rates]
    .filter((r) => r.financial_year < fy && Number.isFinite(Number(r.rate_percent)))
    .sort((a, b) => b.financial_year.localeCompare(a.financial_year));
  const best = prior[0];
  if (!best) return null;
  return { financialYear: best.financial_year, ratePercent: Number(best.rate_percent) };
}

/** Placeholder until Compliance wires real documentation-charge source. */
export const COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER = 0;

export const COMPLIANCE_DEFAULT_ADVANCE_PERCENT = 90;
