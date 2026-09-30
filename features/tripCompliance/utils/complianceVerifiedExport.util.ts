/**
 * Verified-stage Compliance Export Report — spreadsheet columns (CSV).
 * One row per verified trip; money as plain numbers for clean Excel use.
 */
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { COMPLIANCE_STAGE_FILTER_LABEL } from "@/features/tripCompliance/tripCompliance.types";
import {
  COMPLIANCE_DEFAULT_ADVANCE_PERCENT,
  COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER,
  computeCompliancePaymentAmount,
  computeComplianceTdsAmount,
} from "@/features/tripCompliance/utils/compliancePaymentAmount.util";
import { formatComplianceTimestamp } from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { splitHubRouteLocationDisplay } from "@/features/trips/utils/tripLocationDisplay.util";
import { getTripDisplayNumber } from "@/features/trips/services/trips.service";
import { formatIndianVehicleNumber } from "@/lib/format";
import { parseLrFieldValues } from "@/features/trips/services/lrDocumentOcr.util";
import { readStoredInvoiceNumber } from "@/features/trips/components/trip-detail/tripDocTypes";

export const VERIFIED_EXPORT_CSV_HEADERS = [
  "TRIP ID",
  "Verification status",
  "Loading date",
  "Intransit date",
  "Client sales invoice No",
  "Account No",
  "Beneficiary Name",
  "IFSC No",
  "Branch Name",
  "LR No",
  "Customer",
  "Supplier",
  "Source",
  "Destination",
  "Truck No",
  "Truck Type",
  "Driver name",
  "Driver No.",
  "C Price",
  "S Price",
  "% of advance",
  "Documentation charges",
  "TDS",
  "Final Advance",
  "Margin",
  "Margin %",
] as const;

export type VerifiedExportCsvHeader = (typeof VERIFIED_EXPORT_CSV_HEADERS)[number];

export type VerifiedExportCsvRow = Record<VerifiedExportCsvHeader, string>;

export type VerifiedExportEnrichment = {
  supplierName?: string | null;
  truckType?: string | null;
  driverPhone?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  branchName?: string | null;
  /** Vendor vault advance %; falls back to default when null. */
  advancePercent?: number | null;
  /** Supplier TDS rate % for current (or prior) FY. */
  tdsRatePercent?: number | null;
};

type CommercialTrip = {
  client_price?: number | null;
  supplier_rate?: number | null;
  margin?: number | null;
  load_tons?: number | null;
  supplier_rate_basis?: string | null;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function blank(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "";
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 10) / 10);
}

function formatLoadingDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    // Date-only strings (YYYY-MM-DD) — avoid UTC shift by parsing parts.
    const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return blank(iso);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function latestDocNumber(
  documents: ComplianceTripSummary["documents"],
  type: "lr" | "invoice",
): string {
  const matches = documents.filter((doc) => (doc.document_type ?? "").toLowerCase() === type);
  if (matches.length === 0) return "";
  const latest = [...matches].sort((a, b) =>
    (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""),
  )[0];
  const raw = (latest?.document_number ?? "").trim();
  if (!raw) return "";
  if (type === "lr") {
    return parseLrFieldValues(raw).lrNumber?.trim() || raw.replace(/^lr\s*no\.?\s*/i, "").trim();
  }
  return readStoredInvoiceNumber(raw) || raw.replace(/^invoice\s*no\.?\s*/i, "").trim();
}

function supplierCostTotal(trip: CommercialTrip): number | null {
  const rate = Number(trip.supplier_rate);
  if (!Number.isFinite(rate)) return null;
  if (trip.supplier_rate_basis === "per_mt") {
    const tons = Number(trip.load_tons);
    if (Number.isFinite(tons) && tons > 0) return rate * tons;
    return null;
  }
  return rate;
}

function marginValues(trip: CommercialTrip): { margin: number | null; percent: number | null } {
  const client = Number(trip.client_price);
  const cost = supplierCostTotal(trip);
  const stored = Number(trip.margin);
  const margin =
    Number.isFinite(client) && cost != null
      ? client - cost
      : Number.isFinite(stored)
        ? stored
        : null;
  if (margin == null || !Number.isFinite(margin)) return { margin: null, percent: null };
  const percent = Number.isFinite(client) && client > 0 ? (margin / client) * 100 : null;
  return { margin, percent };
}

function placeLabel(raw: string | null | undefined): string {
  const split = splitHubRouteLocationDisplay(raw ?? "");
  const city = split.city?.trim() || "";
  const state = split.state?.trim() || "";
  if (city && state) return `${city}, ${state}`;
  return city || state || blank(raw);
}

/**
 * Build one CSV row for a Verified-stage trip.
 * Enrichment is optional — missing bank/vendor data leaves cells empty.
 */
export function buildVerifiedExportCsvRow(
  summary: ComplianceTripSummary,
  enrichment: VerifiedExportEnrichment = {},
): VerifiedExportCsvRow {
  const trip = summary.trip as typeof summary.trip & CommercialTrip;
  const commercial = trip;
  const supplierLabel =
    blank(enrichment.supplierName) ||
    blank(trip.supplier_name) ||
    "";
  const customer = blank(trip.client_name);
  const source = placeLabel(trip.pickup_area);
  const destination = placeLabel(trip.drop_location ?? trip.drop_area);
  const truckNo =
    formatIndianVehicleNumber(trip.vehicle_display_number?.trim() || "").trim() ||
    blank(trip.vehicle_display_number);
  const driverName = blank(trip.driver_display_name);
  const cPrice = Number(commercial.client_price);
  const sPrice = supplierCostTotal(commercial);
  const advancePercent =
    enrichment.advancePercent != null && Number.isFinite(Number(enrichment.advancePercent))
      ? Number(enrichment.advancePercent)
      : COMPLIANCE_DEFAULT_ADVANCE_PERCENT;
  const documentationCharges = COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER;
  const tdsAmount = computeComplianceTdsAmount(sPrice ?? 0, enrichment.tdsRatePercent);
  const finalAdvance =
    sPrice != null
      ? computeCompliancePaymentAmount({
          baseFreight: sPrice,
          advancePercent,
          documentationCharges,
          tdsAmount,
        })
      : 0;
  const { margin, percent: marginPercent } = marginValues(commercial);

  return {
    "TRIP ID": getTripDisplayNumber(trip, trip.organization_id ?? null),
    "Verification status": COMPLIANCE_STAGE_FILTER_LABEL.compliance_verified,
    "Loading date": formatLoadingDate(trip.pickup_date),
    "Intransit date":
      formatComplianceTimestamp(trip.started_at) === "—"
        ? ""
        : formatComplianceTimestamp(trip.started_at),
    "Client sales invoice No": latestDocNumber(summary.documents, "invoice"),
    "Account No": blank(enrichment.accountNumber),
    "Beneficiary Name": supplierLabel,
    "IFSC No": blank(enrichment.ifsc),
    "Branch Name": blank(enrichment.branchName),
    "LR No": latestDocNumber(summary.documents, "lr"),
    Customer: customer,
    Supplier: supplierLabel,
    Source: source,
    Destination: destination,
    "Truck No": truckNo,
    "Truck Type": blank(enrichment.truckType),
    "Driver name": driverName,
    "Driver No.": blank(enrichment.driverPhone),
    "C Price": Number.isFinite(cPrice) && cPrice > 0 ? formatMoney(cPrice) : "",
    "S Price": formatMoney(sPrice),
    "% of advance": formatMoney(advancePercent),
    "Documentation charges": formatMoney(documentationCharges),
    TDS: formatMoney(tdsAmount),
    "Final Advance": formatMoney(finalAdvance),
    Margin: formatMoney(margin),
    "Margin %": formatPercent(marginPercent),
  };
}

export function verifiedExportRowsToCsv(rows: VerifiedExportCsvRow[]): string {
  const headerLine = VERIFIED_EXPORT_CSV_HEADERS.map((key) => csvEscape(key)).join(",");
  const lines = rows.map((row) =>
    VERIFIED_EXPORT_CSV_HEADERS.map((key) => csvEscape(row[key] ?? "")).join(","),
  );
  return [headerLine, ...lines].join("\n");
}
