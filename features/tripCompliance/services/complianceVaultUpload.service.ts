/**
 * Compliance vault uploads: pick + validate a file, then write it to the right
 * store for its scope. Trip docs go to trip_documents, vehicle RC/insurance/etc.
 * prefer the vehicle vault, and everything else lands in entity_documents.
 * Shared by the Cards workspace (inline Upload / Replace) and the review sheet.
 */
import {
  replaceComplianceDocument,
  uploadComplianceDocument,
} from "@/features/compliance/services/documents.service";
import type { ComplianceEntityDocument } from "@/features/tripCompliance/tripCompliance.types";
import {
  COMPLIANCE_TRIP_DOC_PICKER_TYPES,
  validateComplianceTripDocumentFile,
} from "@/features/tripCompliance/utils/complianceTripDocumentFormat.util";
import {
  isTripDocumentsStoragePathConflict,
  uploadTripDocument,
  type TripDocumentType,
} from "@/features/trips/services/tripDocuments.service";
import {
  resolveVehicleDocumentsWriteTarget,
  uploadAndSaveVehicleDocument,
} from "@/features/vehicles/services/vehicleDocuments.service";
import { getVehicleById } from "@/features/vehicles/services/vehicles.service";
import type { VehicleComplianceDocType } from "@/features/vehicles/utils/vehicleDocuments.util";
import * as DocumentPicker from "expo-document-picker";

export type ComplianceVaultScope = "trip" | "vehicle" | "driver";

export type ComplianceVaultFile = {
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

/** Vehicle doc types stored on `vehicles.documents` (the vehicle vault). */
export const COMPLIANCE_VEHICLE_VAULT_TYPES = new Set([
  "rc",
  "insurance",
  "fitness",
  "pollution",
  "permit",
  "road_tax",
]);

/** Opens the file picker and validates format/size. `null` when the user cancels. */
export async function pickComplianceVaultFile(type: string): Promise<ComplianceVaultFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [...COMPLIANCE_TRIP_DOC_PICKER_TYPES],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const fileName = asset.name ?? `${type}.pdf`;
  if (typeof asset.size === "number") {
    const early = validateComplianceTripDocumentFile({
      fileName,
      mimeType: asset.mimeType,
      byteLength: asset.size,
    });
    if (!early.ok) throw new Error(early.reason);
  }
  const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
  const format = validateComplianceTripDocumentFile({
    fileName,
    mimeType: asset.mimeType,
    byteLength: arrayBuffer.byteLength,
  });
  if (!format.ok) throw new Error(format.reason);
  return { arrayBuffer, fileName, mimeType: format.mimeType };
}

export type ComplianceVaultUploadInput = {
  scope: ComplianceVaultScope;
  type: string;
  tripId: string;
  organizationId: string;
  actorId: string;
  vehicleId: string | null;
  /** Vehicle or driver id for entity scopes; ignored for trip scope. */
  entityId: string | null;
  /** Current file for this type, so a replace updates it instead of adding a duplicate. */
  existing: ComplianceEntityDocument | null | undefined;
  file: ComplianceVaultFile;
  expiryDate: string | null;
};

/**
 * Writes one vault file. Throws on failure. A trip-documents storage path
 * conflict means the file already landed, so it is treated as success.
 */
export async function uploadComplianceVaultFile(input: ComplianceVaultUploadInput): Promise<void> {
  const { scope, type, tripId, organizationId, actorId, vehicleId, entityId, existing, file, expiryDate } = input;

  if (scope === "trip") {
    const { error } = await uploadTripDocument(
      tripId,
      actorId,
      file,
      type as TripDocumentType,
      undefined,
      { replaceExistingOfType: true },
    );
    if (error && !isTripDocumentsStoragePathConflict({ message: error.message })) throw error;
    return;
  }

  if (!entityId) {
    throw new Error(
      scope === "vehicle"
        ? "Assign a vehicle on this trip before uploading documents."
        : "Assign a driver on this trip before uploading documents.",
    );
  }

  if (scope === "vehicle" && COMPLIANCE_VEHICLE_VAULT_TYPES.has(type) && vehicleId) {
    // Prefer the vehicle vault when this org owns the truck. Cross-org / RLS-blocked
    // vault writes fall back to entity_documents so Compliance can still collect it.
    const owned = await getVehicleById(organizationId, vehicleId);
    if (owned.error) throw owned.error;

    let savedToVault = false;
    if (owned.vehicle) {
      const { error } = await uploadAndSaveVehicleDocument(
        organizationId,
        vehicleId,
        type as VehicleComplianceDocType,
        file,
        expiryDate ?? "",
        owned.vehicle.documents ?? null,
      );
      savedToVault = !error;
    } else {
      const resolved = await resolveVehicleDocumentsWriteTarget(vehicleId, [organizationId]);
      if (resolved) {
        const { error } = await uploadAndSaveVehicleDocument(
          resolved.orgId,
          vehicleId,
          type as VehicleComplianceDocType,
          file,
          expiryDate ?? "",
          resolved.documents,
        );
        savedToVault = !error;
      }
    }
    if (savedToVault) return;

    if (existing?.source === "driver-kyc") {
      throw new Error("Replace this file from Trip Operations Asset Vault.");
    }
    const upload = {
      orgId: organizationId,
      entityType: "vehicle" as const,
      entityId: vehicleId,
      docType: type,
      file,
      uploadedBy: actorId,
      expiryDate: expiryDate || null,
    };
    const canReplaceEntity = Boolean(existing?.id) && (existing?.source === "entity" || !existing?.source);
    const { error } = canReplaceEntity && existing
      ? await replaceComplianceDocument({ existingDocId: existing.id, upload })
      : await uploadComplianceDocument(upload);
    if (error) throw error;
    return;
  }

  if (existing?.source === "vehicle-vault" || existing?.source === "driver-kyc") {
    throw new Error("Replace this file from Trip Operations Asset Vault.");
  }
  const upload = {
    orgId: organizationId,
    entityType: scope,
    entityId,
    docType: type,
    file,
    uploadedBy: actorId,
    expiryDate: expiryDate || null,
  };
  const { error } = existing?.id
    ? await replaceComplianceDocument({ existingDocId: existing.id, upload })
    : await uploadComplianceDocument(upload);
  if (error) throw error;
}
