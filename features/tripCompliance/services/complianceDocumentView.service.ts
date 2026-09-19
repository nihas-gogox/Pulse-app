/**
 * Resolve a Compliance checklist file to a viewable HTTPS or blob URL.
 * Vehicle vault files live in `vehicle-documents`; trip files in `trip-documents`;
 * KYC in `driver-documents`; entity_documents in `compliance-documents`.
 */
import { getComplianceDocumentSignedUrl } from "@/features/compliance/services/documents.service";
import { tryGetDocumentViewUrl } from "@/features/trips/services/tripDocuments.service";
import {
  STORAGE_BUCKET_PREFIX_RE,
  complianceStoragePathCandidates,
} from "@/features/tripCompliance/utils/complianceVaultDocuments.util";
import { getVehicleDocumentViewUrl } from "@/features/vehicles/services/vehicleDocuments.service";
import { supabase } from "@/lib/supabase";

export type ComplianceViewSource = "vehicle-vault" | "driver-kyc" | "entity" | "trip" | null | undefined;

type StorageBucket = "vehicle-documents" | "compliance-documents" | "driver-documents" | "trip-documents";

function bucketsForSource(source: ComplianceViewSource): StorageBucket[] {
  if (source === "trip") {
    return ["trip-documents", "vehicle-documents", "compliance-documents", "driver-documents"];
  }
  if (source === "driver-kyc") {
    return ["driver-documents", "vehicle-documents", "compliance-documents", "trip-documents"];
  }
  if (source === "entity") {
    return ["compliance-documents", "vehicle-documents", "driver-documents", "trip-documents"];
  }
  return ["vehicle-documents", "compliance-documents", "driver-documents", "trip-documents"];
}

/**
 * Signed URLs are cached per bucket+path. Previously only the
 * `compliance-documents` branch cached, so every re-render re-signed against
 * the other three buckets.
 */
const SIGNED_URL_TTL_SEC = 3600;
const SIGNED_URL_CACHE_TTL_MS = (SIGNED_URL_TTL_SEC - 120) * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

/**
 * A raw path is bucket-qualified when it still carries its bucket prefix, so
 * we can sign against exactly one bucket instead of probing all four.
 */
function bucketFromRawPath(raw: string | null | undefined): StorageBucket | null {
  const match = (raw ?? "").trim().replace(/^\//, "").match(STORAGE_BUCKET_PREFIX_RE);
  const bucket = match?.[1];
  if (
    bucket === "vehicle-documents" ||
    bucket === "compliance-documents" ||
    bucket === "driver-documents" ||
    bucket === "trip-documents"
  ) {
    return bucket;
  }
  return null;
}

async function signFromBucket(bucket: StorageBucket, path: string): Promise<string | null> {
  const cacheKey = `${bucket}:${path}`;
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAtMs > now) return cached.url;

  let url: string | null = null;
  try {
    if (bucket === "vehicle-documents") {
      url = await getVehicleDocumentViewUrl(path);
    } else if (bucket === "trip-documents") {
      url = await tryGetDocumentViewUrl(path);
    } else if (bucket === "compliance-documents") {
      url = (await getComplianceDocumentSignedUrl(path)).url;
    } else {
      const { data } = await supabase().storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SEC);
      url = data?.signedUrl ?? null;
    }
  } catch {
    return null;
  }

  if (url) signedUrlCache.set(cacheKey, { url, expiresAtMs: now + SIGNED_URL_CACHE_TTL_MS });
  return url;
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

  // If the stored path names its own bucket, that is the only bucket worth
  // trying; otherwise fall back to source-ordered probing.
  const qualified = bucketFromRawPath(input.storagePath);
  const buckets = qualified ? [qualified] : bucketsForSource(input.source);

  for (const path of paths) {
    for (const bucket of buckets) {
      const signed = await signFromBucket(bucket, path);
      if (signed) return signed;
    }
  }

  // Downloading pulls full file bytes, so only retry the single most likely
  // bucket/path rather than replaying the entire signing matrix.
  const primaryPath = paths[0];
  const primaryBucket = buckets[0];
  if (primaryPath && primaryBucket) {
    return await downloadFromBucket(primaryBucket, primaryPath);
  }
  return null;
}

export function guessCompliancePreviewMime(pathOrName: string | null | undefined): string | null {
  const value = (pathOrName ?? "").toLowerCase();
  if (value.endsWith(".pdf") || value.includes(".pdf?")) return "application/pdf";
  if (value.endsWith(".png") || value.includes(".png?")) return "image/png";
  if (value.endsWith(".webp") || value.includes(".webp?")) return "image/webp";
  if (/\.jpe?g(\?|$)/.test(value)) return "image/jpeg";
  return null;
}
