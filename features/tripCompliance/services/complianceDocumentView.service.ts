/**
 * Resolve a Compliance checklist file to a viewable HTTPS URL.
 * Driver-app pattern: sign the stored object path once on its source bucket.
 * Do not probe extra vault extensions or download blobs (that fans out Storage/RLS).
 */
import { getComplianceDocumentSignedUrl } from "@/features/compliance/services/documents.service";
import { tryGetDocumentViewUrl } from "@/features/trips/services/tripDocuments.service";
import { parseComplianceStorageRef } from "@/features/tripCompliance/utils/complianceVaultDocuments.util";
import { getVehicleDocumentViewUrl } from "@/features/vehicles/services/vehicleDocuments.service";
import { supabase } from "@/lib/supabase";

export type ComplianceViewSource = "vehicle-vault" | "driver-kyc" | "entity" | "trip" | null | undefined;

export async function signCompliancePreviewUrl(input: {
  storagePath: string | null | undefined;
  source?: ComplianceViewSource;
}): Promise<string | null> {
  const raw = (input.storagePath ?? "").trim();
  if (!raw) return null;
  const parsed = parseComplianceStorageRef(raw);
  if (parsed.kind === "url") return parsed.value;
  const path = parsed.value.trim();
  if (!path) return null;
  const source = input.source ?? "trip";
  try {
    if (source === "vehicle-vault") return await getVehicleDocumentViewUrl(path);
    if (source === "entity") {
      const { url } = await getComplianceDocumentSignedUrl(path);
      return url;
    }
    if (source === "driver-kyc") {
      const { data } = await supabase().storage.from("driver-documents").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    }
    return await tryGetDocumentViewUrl(path);
  } catch {
    return null;
  }
}

/** @deprecated Use signCompliancePreviewUrl — kept for callers that still pass vault guess fields. */
export async function resolveComplianceDocumentViewUrl(input: {
  storagePath: string | null | undefined;
  source?: ComplianceViewSource;
  organizationId?: string | null;
  entityId?: string | null;
  docType?: string | null;
}): Promise<string | null> {
  return signCompliancePreviewUrl({
    storagePath: input.storagePath,
    source: input.source,
  });
}

export function guessCompliancePreviewMime(
  pathOrName: string | null | undefined,
  mimeType?: string | null,
): string | null {
  const declared = (mimeType ?? "").trim().toLowerCase();
  if (declared) return declared;
  const value = (pathOrName ?? "").toLowerCase();
  if (value.endsWith(".pdf") || value.includes(".pdf?")) return "application/pdf";
  if (value.endsWith(".png") || value.includes(".png?")) return "image/png";
  if (value.endsWith(".webp") || value.includes(".webp?")) return "image/webp";
  if (/\.jpe?g(\?|$)/.test(value)) return "image/jpeg";
  if (value.endsWith(".txt") || value.includes(".txt?")) return "text/plain";
  return null;
}
