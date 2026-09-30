/**
 * Vehicle documents — upload, view, delete for RC, insurance, fitness, PUC.
 * Storage: vehicle-documents bucket, path {orgId}/{vehicleId}/{docType}.{ext}.
 * Metadata: vehicles.documents JSONB column (no separate table).
 *
 * Edge cases handled:
 *  - File size/type validation before upload
 *  - Rollback: if DB update fails after storage upload, the orphaned file is removed
 *  - Re-upload (upsert): overwrites same path, so no orphan files accumulate
 *  - Delete: removes storage object + clears JSONB key in one call
 */
import { supabase } from '@/lib/supabase';
import { createStorageSignedUrlCache } from '@/lib/storageSignedUrlCache';
import type {
  DocumentWithExpiry,
  VehicleComplianceDocType,
  VehicleDocuments,
  VehicleExtraDocument,
} from '../utils/vehicleDocuments.util';

const BUCKET = 'vehicle-documents';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const STORAGE_RETRY_DELAYS_MS = [250, 800, 1800] as const;

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export interface UploadVehicleDocumentResult {
  storagePath: string | null;
  error: Error | null;
}

export interface DeleteVehicleDocumentResult {
  error: Error | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStorageError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('connection') ||
    m.includes('network') ||
    m.includes('fetch failed') ||
    m.includes('gateway')
  );
}

async function runWithStorageRetry<T>(op: () => Promise<T>, classifyError: (value: T) => string | null): Promise<T> {
  let lastResult: T | null = null;
  for (let i = 0; i < STORAGE_RETRY_DELAYS_MS.length + 1; i += 1) {
    const result = await op();
    lastResult = result;
    const errMessage = classifyError(result);
    if (!errMessage || !isTransientStorageError(errMessage)) return result;
    if (i < STORAGE_RETRY_DELAYS_MS.length) {
      await sleep(STORAGE_RETRY_DELAYS_MS[i]);
    }
  }
  return lastResult as T;
}

const vehicleDocSignedUrls = createStorageSignedUrlCache({
  async signOne(path, expiresInSec) {
    const { data, error } = await runWithStorageRetry(
      () =>
        supabase()
          .storage
          .from(BUCKET)
          .createSignedUrl(path, expiresInSec, { download: false }),
      (result) => result.error?.message ?? null,
    );
    return {
      signedUrl: data?.signedUrl ?? null,
      error: error?.message ?? null,
    };
  },
  async signMany(paths, expiresInSec) {
    const { data, error } = await runWithStorageRetry(
      () =>
        supabase()
          .storage
          .from(BUCKET)
          .createSignedUrls(paths, expiresInSec, { download: false }),
      (value) => value.error?.message ?? null,
    );
    if (error) {
      return paths.map((path) => ({
        path,
        signedUrl: null,
        error: error.message,
      }));
    }
    return (data ?? []).map((row) => ({
      path: row.path ?? '',
      signedUrl: row.error ? null : row.signedUrl,
      error: row.error,
    }));
  },
});

function invalidateVehicleDocUrl(storagePath: string, extraPrefix?: string): void {
  vehicleDocSignedUrls.invalidate(storagePath);
  if (extraPrefix) vehicleDocSignedUrls.invalidatePrefix(extraPrefix);
}

/**
 * Validate file before attempting an upload. Returns null if valid, or an error message.
 * O(1) — two constant-time checks.
 */
export function validateDocumentFile(file: {
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  mimeType: string;
}): string | null {
  const byteLength = file.blob?.size ?? file.arrayBuffer?.byteLength ?? 0;
  if (!byteLength) return 'File is empty';
  if (byteLength > MAX_FILE_SIZE_BYTES)
    return `File too large (${(byteLength / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`;
  const mime = (file.mimeType ?? '').toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime))
    return `Unsupported file type (${mime}). Use JPEG, PNG, WebP, or PDF.`;
  return null;
}

/**
 * Get a time-limited signed URL for viewing a vehicle document.
 * Cached for ~58 minutes; concurrent callers share one in-flight request.
 */
export async function getVehicleDocumentViewUrl(storagePath: string): Promise<string | null> {
  return vehicleDocSignedUrls.getUrl(storagePath);
}

/** One storage round-trip for all uncached vehicle document paths. */
export async function getVehicleDocumentViewUrls(
  storagePaths: string[],
): Promise<Record<string, string | null>> {
  return vehicleDocSignedUrls.getUrls(storagePaths);
}

function extraDocumentId(): string {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upload a document file for a vehicle. Returns storage path on success.
 *
 * Path scheme: {orgId}/{vehicleId}/{docType}.{ext}
 *   → deterministic per doc type, so re-upload overwrites (no orphan files).
 *
 * O(1) — one storage write (upsert).
 */
export async function uploadVehicleDocument(
  orgId: string,
  vehicleId: string,
  docType: VehicleComplianceDocType,
  file: { arrayBuffer?: ArrayBuffer; fileName: string; mimeType: string; blob?: Blob },
): Promise<UploadVehicleDocumentResult> {
  const validationError = validateDocumentFile(file);
  if (validationError) return { storagePath: null, error: new Error(validationError) };

  const ext = file.fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${orgId}/${vehicleId}/${docType}.${ext}`;

  const { error } = await runWithStorageRetry(
    () =>
      supabase()
        .storage
        .from(BUCKET)
        .upload(path, file.blob ?? file.arrayBuffer, {
          contentType: file.mimeType || 'image/jpeg',
          upsert: true,
        }),
    (result) => result.error?.message ?? null,
  );

  if (error) return { storagePath: null, error: new Error(error.message) };
  invalidateVehicleDocUrl(path, `${orgId}/${vehicleId}/${docType}.`);
  return { storagePath: path, error: null };
}

/**
 * Remove a vehicle document from storage.
 * O(1) — single storage delete.
 */
export async function deleteVehicleDocumentFile(storagePath: string): Promise<DeleteVehicleDocumentResult> {
  if (!storagePath?.trim()) return { error: null };
  const { error } = await runWithStorageRetry(
    () =>
      supabase()
        .storage
        .from(BUCKET)
        .remove([storagePath]),
    (result) => result.error?.message ?? null,
  );
  if (error) return { error: new Error(error.message) };
  invalidateVehicleDocUrl(storagePath);
  return { error: null };
}

/**
 * Full upload + DB save in a single transaction-like call.
 * If the DB update fails, the uploaded file is rolled back (deleted).
 *
 * O(1) — one storage write + one DB update (+ optional rollback delete).
 */
export async function uploadAndSaveVehicleDocument(
  orgId: string,
  vehicleId: string,
  docType: VehicleComplianceDocType,
  file: { arrayBuffer?: ArrayBuffer; fileName: string; mimeType: string; blob?: Blob },
  expiryDate: string,
  existingDocuments: VehicleDocuments | null,
): Promise<{ documents: VehicleDocuments | null; error: Error | null }> {
  // 1. Upload to storage
  const { storagePath, error: uploadErr } = await uploadVehicleDocument(orgId, vehicleId, docType, file);
  if (uploadErr || !storagePath) return { documents: null, error: uploadErr ?? new Error('Upload failed') };

  // 2. Build updated JSONB
  const updated: VehicleDocuments = { ...(existingDocuments ?? {}) };
  updated[docType] = {
    url: storagePath,
    expiryDate,
    uploadedAt: new Date().toISOString(),
  };

  // 3. Persist to vehicles.documents
  const { data: savedRow, error: dbError } = await supabase()
    .from('vehicles')
    .update({ documents: updated })
    .eq('organization_id', orgId)
    .eq('id', vehicleId)
    .select('id, documents')
    .maybeSingle();

  if (dbError || !savedRow) {
    // Rollback: remove the just-uploaded file so we don't leave orphans
    await deleteVehicleDocumentFile(storagePath).catch(() => {});
    return {
      documents: null,
      error: new Error(
        dbError?.message ??
          'Vehicle document metadata was not saved (row not found or insufficient permission).',
      ),
    };
  }

  const persistedDocs = (savedRow.documents ?? {}) as VehicleDocuments;
  return { documents: persistedDocs, error: null };
}

/**
 * Upload extra vehicle files from the trip vault (does not replace RC / insurance / fitness / PUC).
 * Path: {orgId}/{vehicleId}/extras/{id}.{ext}
 */
export async function uploadAndSaveVehicleExtraDocuments(
  orgId: string,
  vehicleId: string,
  files: { arrayBuffer?: ArrayBuffer; blob?: Blob; fileName: string; mimeType: string }[],
  existingDocuments: VehicleDocuments | null,
): Promise<{ documents: VehicleDocuments | null; error: Error | null }> {
  if (files.length === 0) {
    return { documents: existingDocuments, error: new Error('No files selected') };
  }

  const uploaded: VehicleExtraDocument[] = [];
  for (const file of files) {
    const validationError = validateDocumentFile(file);
    if (validationError) {
      await Promise.all(uploaded.map((item) => deleteVehicleDocumentFile(item.url).catch(() => {})));
      return { documents: null, error: new Error(validationError) };
    }
    const extraId = extraDocumentId();
    const ext = file.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${orgId}/${vehicleId}/extras/${extraId}.${ext}`;
    const { error } = await runWithStorageRetry(
      () =>
        supabase()
          .storage
          .from(BUCKET)
          .upload(path, file.blob ?? file.arrayBuffer!, {
            contentType: file.mimeType || 'image/jpeg',
            upsert: false,
          }),
      (result) => result.error?.message ?? null,
    );
    if (error) {
      await Promise.all(uploaded.map((item) => deleteVehicleDocumentFile(item.url).catch(() => {})));
      return { documents: null, error: new Error(error.message) };
    }
    invalidateVehicleDocUrl(path);
    uploaded.push({
      id: extraId,
      url: path,
      expiryDate: '',
      uploadedAt: new Date().toISOString(),
      fileName: file.fileName,
    });
  }

  const updated: VehicleDocuments = {
    ...(existingDocuments ?? {}),
    extras: [...(existingDocuments?.extras ?? []), ...uploaded],
  };

  const { data: savedRow, error: dbError } = await supabase()
    .from('vehicles')
    .update({ documents: updated })
    .eq('organization_id', orgId)
    .eq('id', vehicleId)
    .select('id, documents')
    .maybeSingle();

  if (dbError || !savedRow) {
    await Promise.all(uploaded.map((item) => deleteVehicleDocumentFile(item.url).catch(() => {})));
    return {
      documents: null,
      error: new Error(
        dbError?.message ??
          'Vehicle document metadata was not saved (row not found or insufficient permission).',
      ),
    };
  }

  return { documents: (savedRow.documents ?? updated) as VehicleDocuments, error: null };
}

export async function deleteVehicleExtraDocument(
  orgId: string,
  vehicleId: string,
  extraId: string,
  existingDocuments: VehicleDocuments | null,
): Promise<{ documents: VehicleDocuments | null; error: Error | null }> {
  const extras = existingDocuments?.extras ?? [];
  const extra = extras.find((item) => item.id === extraId);
  if (!extra) {
    return {
      documents: existingDocuments,
      error: new Error("That vehicle file is no longer on record."),
    };
  }
  if (extra.url?.trim()) {
    await deleteVehicleDocumentFile(extra.url).catch(() => {});
  }
  const nextExtras = extras.filter((item) => item.id !== extraId);
  const updated: VehicleDocuments = { ...(existingDocuments ?? {}) };
  if (nextExtras.length > 0) updated.extras = nextExtras;
  else delete updated.extras;

  const { error: dbError } = await supabase()
    .from("vehicles")
    .update({ documents: updated })
    .eq("organization_id", orgId)
    .eq("id", vehicleId);

  if (dbError) return { documents: null, error: new Error(dbError.message) };
  return { documents: updated, error: null };
}

/**
 * Delete a document type for a vehicle (storage file + clear JSONB key).
 *
 * O(1) — one storage delete + one DB update.
 */
export async function deleteVehicleDocument(
  orgId: string,
  vehicleId: string,
  docType: VehicleComplianceDocType,
  existingDocuments: VehicleDocuments | null,
): Promise<{ documents: VehicleDocuments | null; error: Error | null }> {
  const doc: DocumentWithExpiry | undefined = existingDocuments?.[docType];
  const storagePath = doc?.url;

  // Remove storage file (best-effort; even if missing, clear JSONB)
  if (storagePath?.trim()) {
    await deleteVehicleDocumentFile(storagePath).catch(() => {});
  }

  const updated: VehicleDocuments = { ...(existingDocuments ?? {}) };
  delete updated[docType];

  const { error: dbError } = await supabase()
    .from('vehicles')
    .update({ documents: updated })
    .eq('organization_id', orgId)
    .eq('id', vehicleId);

  if (dbError) return { documents: null, error: new Error(dbError.message) };
  return { documents: updated, error: null };
}
