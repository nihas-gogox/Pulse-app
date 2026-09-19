/**
 * Resolve a Compliance checklist file to a viewable HTTPS or blob URL.
 * Vehicle vault files live in `vehicle-documents`; trip files in `trip-documents`;
 * KYC in `driver-documents`; entity_documents in `compliance-documents`.
 */
import { getComplianceDocumentSignedUrl } from "@/features/compliance/services/documents.service";
import { tryGetDocumentViewUrl } from "@/features/trips/services/tripDocuments.service";
import {
  complianceStoragePathCandidates,
} from "@/features/tripCompliance/utils/complianceVaultDocuments.util";
import { getVehicleDocumentViewUrl } from "@/features/vehicles/services/vehicleDocuments.service";
import { supabase } from "@/lib/supabase";

export type ComplianceViewSource = "vehicle-vault" | "driver-kyc" | "entity" | "trip" | null | undefined;

type StorageBucket = "vehicle-documents" | "compliance-documents" | "driver-documents" | "trip-documents";

function bucketsForSource(source: ComplianceViewSource): StorageBucket[] {
  if (source === "trip") return ["trip-documents"];
  if (source === "driver-kyc") return ["driver-documents"];
  if (source === "entity") return ["compliance-documents"];
  if (source === "vehicle-vault") return ["vehicle-documents"];
  return ["vehicle-documents", "compliance-documents", "driver-documents", "trip-documents"];
}

async function signFromBucket(bucket: StorageBucket, path: string): Promise<string | null> {
  try {
    if (bucket === "vehicle-documents") return await getVehicleDocumentViewUrl(path);
    if (bucket === "trip-documents") return await tryGetDocumentViewUrl(path);
    if (bucket === "compliance-documents") {
      const { url } = await getComplianceDocumentSignedUrl(path);
      return url;
    }
    const { data } = await supabase().storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function downloadFromBucket(bucket: StorageBucket, path: string): Promise<string | null> {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  try {
    const { data, error } = await supabase().storage.from(bucket).download(path);
    if (error || !data) return null;
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}

export async function resolveComplianceDocumentViewUrl(input: {
  storagePath: string | null | undefined;
  source?: ComplianceViewSource;
  organizationId?: string | null;
  entityId?: string | null;
  docType?: string | null;
}): Promise<string | null> {
  const { url, paths } = complianceStoragePathCandidates({
    rawPath: input.storagePath,
    organizationId: input.organizationId,
    entityId: input.entityId,
    docType: input.docType,
  });
  if (url) return url;

  const buckets = bucketsForSource(input.source);
  for (const path of paths) {
    for (const bucket of buckets) {
      const signed = await signFromBucket(bucket, path);
      if (signed) return signed;
    }
  }
  const primary = buckets[0];
  if (primary) {
    for (const path of paths) {
      const blobUrl = await downloadFromBucket(primary, path);
      if (blobUrl) return blobUrl;
    }
  }
  return null;
}

export function guessCompliancePreviewMime(pathOrName: string | null | undefined): string | null {
  const value = (pathOrName ?? "").toLowerCase();
  if (value.endsWith(".pdf") || value.includes(".pdf?")) return "application/pdf";
  if (value.endsWith(".png") || value.includes(".png?")) return "image/png";
  if (value.endsWith(".webp") || value.includes(".webp?")) return "image/webp";
  if (/\.jpe?g(\?|$)/.test(value)) return "image/jpeg";
  if (value.endsWith(".txt") || value.includes(".txt?")) return "text/plain";
  return null;
}
