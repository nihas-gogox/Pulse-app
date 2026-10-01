/**
 * CSV download for Compliance Export Report (Verified stage only).
 * Builds the payment-sheet columns from trip + supplier vault + vehicle facts.
 */
import { getDriverPhonesByIds } from "@/features/drivers/services/drivers.service";
import { getDocumentChargeConfig } from "@/features/organization/services/documentCharges.service";
import {
  getSupplierBankAccount,
  getVendorOnboardingProfile,
  listSupplierTdsRates,
} from "@/features/suppliers/services/supplierVendorOnboarding.service";
import { getSupplierById, getSupplierDetails } from "@/features/suppliers/services/suppliers.service";
import { buildComplianceTripSummaries } from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import {
  resolveComplianceTdsRate,
  type ComplianceDocumentChargeConfig,
} from "@/features/tripCompliance/utils/compliancePaymentAmount.util";
import {
  buildVerifiedExportCsvRow,
  buildVerifiedExportWorkbook,
  type VerifiedExportEnrichment,
} from "@/features/tripCompliance/utils/complianceVerifiedExport.util";
import { selectCompliancePipelineTrips } from "@/features/tripCompliance/utils/compliancePipelineTrips.util";
import { getTripExecutionModel } from "@/features/trips/domain/tripExecutionModel";
import { getTripsForOrg } from "@/features/trips/services/trips.service";
import { getVehicleById, getVehicleForTripViewer } from "@/features/vehicles/services/vehicles.service";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { Platform, Share } from "react-native";

function triggerWebDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function exportComplianceWorkbook(workbook: XLSX.WorkBook, fileName: string): Promise<void> {
  if (Platform.OS === "web") {
    const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    triggerWebDownload(new Blob([arrayBuffer], { type: XLSX_MIME }), fileName);
    return;
  }
  const cacheDirectory = (FileSystem as { cacheDirectory?: string }).cacheDirectory;
  if (!cacheDirectory) throw new Error("No cache directory available");
  const uri = `${cacheDirectory}${fileName}`;
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: XLSX_MIME,
      dialogTitle: "Save or share Compliance report",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  } else {
    await Share.share({ url: uri, title: "Compliance Report" });
  }
}

function exportFileStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

async function fetchVerifiedStageSummaries(orgId: string): Promise<ComplianceTripSummary[]> {
  const { error, trips } = await getTripsForOrg(orgId);
  if (error) throw error;
  const summaries = await buildComplianceTripSummaries(selectCompliancePipelineTrips(trips));
  return summaries.filter((summary) => summary.stage === "compliance_verified");
}

function supplierLabelFromRow(row: {
  name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
} | null): string {
  if (!row) return "";
  return (row.name ?? row.company_name ?? row.contact_person ?? "").trim();
}

async function resolveSupplierName(
  orgId: string,
  supplierId: string,
  fallback: string | null | undefined,
): Promise<string> {
  const details = await getSupplierDetails(supplierId);
  let label = supplierLabelFromRow(details.supplier);
  if (!label) {
    const owned = await getSupplierById(orgId, supplierId);
    label = supplierLabelFromRow(owned.supplier);
  }
  return label || (fallback ?? "").trim();
}

async function resolveTruckType(
  orgId: string,
  vehicleId: string,
  tripId: string,
): Promise<string> {
  const owned = await getVehicleById(orgId, vehicleId);
  const ownedType = owned.vehicle?.vehicle_type?.trim() || "";
  if (ownedType) return ownedType;
  const shared = await getVehicleForTripViewer(vehicleId, tripId, orgId);
  return shared.vehicle?.vehicle_type?.trim() || "";
}

type SupplierVaultBundle = {
  name: string;
  accountNumber: string;
  ifsc: string;
  branchName: string;
  advancePercent: number | null;
  tdsRatePercent: number | null;
};

async function loadSupplierVaultBundle(
  orgId: string,
  supplierId: string,
  fallbackName: string,
): Promise<SupplierVaultBundle> {
  const [name, bank, profile, tds] = await Promise.all([
    resolveSupplierName(orgId, supplierId, fallbackName),
    getSupplierBankAccount(orgId, supplierId),
    getVendorOnboardingProfile(orgId, supplierId),
    listSupplierTdsRates(orgId, supplierId),
  ]);
  const resolvedTds = resolveComplianceTdsRate(tds.rates);
  const adv = profile.profile?.advance_percentage;
  return {
    name,
    accountNumber: String(bank.account?.account_number ?? "").trim(),
    ifsc: String(bank.account?.ifsc_code ?? "").trim().toUpperCase(),
    branchName: bank.account?.bank_name?.trim() || "",
    advancePercent:
      adv != null && Number.isFinite(Number(adv)) ? Number(adv) : null,
    tdsRatePercent: resolvedTds?.ratePercent ?? null,
  };
}

/**
 * Build enrichment maps for verified trips (bank, vendor %, TDS, truck, driver phone).
 */
export async function buildVerifiedExportEnrichment(
  orgId: string,
  summaries: ComplianceTripSummary[],
): Promise<Map<string, VerifiedExportEnrichment>> {
  const byTrip = new Map<string, VerifiedExportEnrichment>();
  if (summaries.length === 0) return byTrip;

  const supplierCache = new Map<string, Promise<SupplierVaultBundle>>();
  const truckCache = new Map<string, Promise<string>>();
  const driverIds = Array.from(
    new Set(
      summaries
        .map((s) => s.trip.driver_id?.trim() || "")
        .filter((id) => id.length > 0),
    ),
  );
  const phonesPromise = getDriverPhonesByIds(driverIds);
  const docChargeCache = new Map<string, Promise<ComplianceDocumentChargeConfig | null>>();
  const docChargeConfigFor = (id: string) => {
    let pending = docChargeCache.get(id);
    if (!pending) {
      pending = getDocumentChargeConfig(id).then(({ data }) => data);
      docChargeCache.set(id, pending);
    }
    return pending;
  };

  const enrichmentJobs = summaries.map(async (summary) => {
    const trip = summary.trip;
    const tripOrgId = (trip.organization_id ?? orgId).trim() || orgId;
    const supplierId = trip.supplier_id?.trim() || "";
    const vehicleId = trip.vehicle_id?.trim() || "";
    const isAsset = getTripExecutionModel(trip) === "asset";
    const enrichment: VerifiedExportEnrichment = {
      documentChargeConfig: await docChargeConfigFor(tripOrgId),
    };

    if (isAsset && !supplierId) {
      enrichment.supplierName = "Own fleet";
    } else if (supplierId) {
      let pending = supplierCache.get(supplierId);
      if (!pending) {
        pending = loadSupplierVaultBundle(tripOrgId, supplierId, trip.supplier_name ?? "");
        supplierCache.set(supplierId, pending);
      }
      const vault = await pending;
      enrichment.supplierName = vault.name;
      enrichment.accountNumber = vault.accountNumber;
      enrichment.ifsc = vault.ifsc;
      enrichment.branchName = vault.branchName;
      enrichment.advancePercent = vault.advancePercent;
      enrichment.tdsRatePercent = vault.tdsRatePercent;
    } else {
      enrichment.supplierName = (trip.supplier_name ?? "").trim();
    }

    if (vehicleId) {
      const cacheKey = `${tripOrgId}:${vehicleId}:${trip.id}`;
      let pending = truckCache.get(cacheKey);
      if (!pending) {
        pending = resolveTruckType(tripOrgId, vehicleId, trip.id);
        truckCache.set(cacheKey, pending);
      }
      enrichment.truckType = await pending;
    }

    byTrip.set(trip.id, enrichment);
  });

  const [{ phoneByDriverId }] = await Promise.all([phonesPromise, Promise.all(enrichmentJobs)]);

  for (const summary of summaries) {
    const enrichment = byTrip.get(summary.trip.id) ?? {};
    const driverId = summary.trip.driver_id?.trim() || "";
    if (driverId) {
      enrichment.driverPhone = phoneByDriverId.get(driverId) ?? "";
    }
    byTrip.set(summary.trip.id, enrichment);
  }

  return byTrip;
}

/** Download Verified-stage Excel report (.xlsx). Returns trip row count exported. */
export async function exportVerifiedStageComplianceReport(orgId: string): Promise<number> {
  const summaries = await fetchVerifiedStageSummaries(orgId);
  if (summaries.length === 0) return 0;

  const enrichmentByTrip = await buildVerifiedExportEnrichment(orgId, summaries);
  const rows = summaries.map((summary) =>
    buildVerifiedExportCsvRow(summary, enrichmentByTrip.get(summary.trip.id) ?? {}),
  );
  await exportComplianceWorkbook(
    buildVerifiedExportWorkbook(rows),
    `compliance-verified-report_${exportFileStamp()}.xlsx`,
  );
  return rows.length;
}
