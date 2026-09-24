/**
 * Fleet Owner vehicle document vault — dedicated bucket, not Business vehicle-documents.
 * Path: {owner_user_id}/{owner_vehicle_id}/{document_id}.{ext}
 */
import { supabase } from '@pulse/core/lib/supabase';
import { uuidv7 } from '@pulse/core/lib/uuidv7';
import type { OwnerVehicleDocType } from '../utils/ownerVehicleDocuments.util';

const BUCKET = 'owner-vehicle-documents';
const SIGNED_URL_EXPIRY_SEC = 3600;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_CACHE_TTL_MS = (SIGNED_URL_EXPIRY_SEC - 120) * 1000;

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export type OwnerVehicleDocumentRow = {
  id: string;
  owner_vehicle_id: string;
  owner_user_id: string;
  document_type: OwnerVehicleDocType;
  document_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  status: 'current' | 'replaced' | 'deleted';
  replaced_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OwnerDocUploadFile = {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fileName?: string;
};

type SignedUrlCacheEntry = { url: string; expiresAtMs: number };
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

const DOC_SELECT =
  'id,owner_vehicle_id,owner_user_id,document_type,document_number,issued_at,expires_at,storage_path,mime_type,file_name,file_size_bytes,status,replaced_by,metadata,created_at,updated_at';

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('heic') || m.includes('heif')) return 'heic';
  return 'jpg';
}

export function validateOwnerDocumentFile(file: OwnerDocUploadFile): string | null {
  if (!file.arrayBuffer?.byteLength) return 'File is empty';
  if (file.arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return `File too large (${(file.arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`;
  }
  const mime = (file.mimeType ?? '').toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    return `Unsupported file type (${mime}). Use JPEG, PNG, WebP, or PDF.`;
  }
  return null;
}

export async function listCurrentOwnerVehicleDocuments(
  ownerUserId: string,
  ownerVehicleId: string,
): Promise<{ error: Error | null; documents: OwnerVehicleDocumentRow[] }> {
  const { data, error } = await supabase()
    .from('owner_vehicle_documents')
    .select(DOC_SELECT)
    .eq('owner_user_id', ownerUserId)
    .eq('owner_vehicle_id', ownerVehicleId)
    .eq('status', 'current')
    .order('document_type', { ascending: true });
  if (error) return { error: new Error(error.message), documents: [] };
  return { error: null, documents: (data ?? []) as OwnerVehicleDocumentRow[] };
}

export async function getOwnerVehicleDocumentViewUrl(
  storagePath: string,
): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAtMs > Date.now()) return cached.url;

  const { data, error } = await supabase()
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SEC);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAtMs: Date.now() + SIGNED_URL_CACHE_TTL_MS,
  });
  return data.signedUrl;
}

export type UpsertOwnerVehicleDocumentInput = {
  ownerUserId: string;
  ownerVehicleId: string;
  documentType: OwnerVehicleDocType;
  file: OwnerDocUploadFile;
  documentNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
};

/**
 * Upload new current document; supersedes any existing current row of the same type.
 */
export async function uploadOwnerVehicleDocument(
  input: UpsertOwnerVehicleDocumentInput,
): Promise<{ error: Error | null; document: OwnerVehicleDocumentRow | null }> {
  const validation = validateOwnerDocumentFile(input.file);
  if (validation) return { error: new Error(validation), document: null };

  const docId = uuidv7();
  const ext = extFromMime(input.file.mimeType);
  const storagePath = `${input.ownerUserId}/${input.ownerVehicleId}/${docId}.${ext}`;
  const fileName =
    input.file.fileName?.trim() ||
    `${input.documentType}.${ext}`;

  const { error: uploadError } = await supabase()
    .storage
    .from(BUCKET)
    .upload(storagePath, input.file.arrayBuffer, {
      contentType: input.file.mimeType || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    return { error: new Error(uploadError.message), document: null };
  }

  const { data: existing } = await supabase()
    .from('owner_vehicle_documents')
    .select('id, storage_path')
    .eq('owner_vehicle_id', input.ownerVehicleId)
    .eq('document_type', input.documentType)
    .eq('status', 'current')
    .maybeSingle();

  // Clear the unique (vehicle, type) where status=current before inserting the replacement.
  if (existing?.id) {
    const { error: demoteError } = await supabase()
      .from('owner_vehicle_documents')
      .update({ status: 'replaced' })
      .eq('id', existing.id);
    if (demoteError) {
      await supabase().storage.from(BUCKET).remove([storagePath]);
      return { error: new Error(demoteError.message), document: null };
    }
  }

  const { data: inserted, error: insertError } = await supabase()
    .from('owner_vehicle_documents')
    .insert({
      id: docId,
      owner_vehicle_id: input.ownerVehicleId,
      owner_user_id: input.ownerUserId,
      document_type: input.documentType,
      document_number: (input.documentNumber ?? '').trim() || null,
      issued_at: input.issuedAt || null,
      expires_at: input.expiresAt || null,
      storage_path: storagePath,
      mime_type: input.file.mimeType || null,
      file_name: fileName,
      file_size_bytes: input.file.arrayBuffer.byteLength,
      status: 'current',
      metadata: {},
    } as Record<string, unknown>)
    .select(DOC_SELECT)
    .single();

  if (insertError || !inserted) {
    await supabase().storage.from(BUCKET).remove([storagePath]);
    // Best-effort restore previous current row if demotion happened.
    if (existing?.id) {
      await supabase()
        .from('owner_vehicle_documents')
        .update({ status: 'current', replaced_by: null })
        .eq('id', existing.id);
    }
    return {
      error: new Error(insertError?.message ?? 'Could not save document'),
      document: null,
    };
  }

  if (existing?.id) {
    await supabase()
      .from('owner_vehicle_documents')
      .update({ replaced_by: docId })
      .eq('id', existing.id);
  }

  return { error: null, document: inserted as OwnerVehicleDocumentRow };
}

export async function updateOwnerVehicleDocumentMeta(
  ownerUserId: string,
  documentId: string,
  patch: {
    documentNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
  },
): Promise<{ error: Error | null; document: OwnerVehicleDocumentRow | null }> {
  const updates: Record<string, unknown> = {};
  if (patch.documentNumber !== undefined) {
    updates.document_number = (patch.documentNumber ?? '').trim() || null;
  }
  if (patch.issuedAt !== undefined) updates.issued_at = patch.issuedAt || null;
  if (patch.expiresAt !== undefined) updates.expires_at = patch.expiresAt || null;
  if (Object.keys(updates).length === 0) {
    return { error: null, document: null };
  }

  const { data, error } = await supabase()
    .from('owner_vehicle_documents')
    .update(updates)
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('status', 'current')
    .select(DOC_SELECT)
    .single();
  if (error) return { error: new Error(error.message), document: null };
  return { error: null, document: data as OwnerVehicleDocumentRow };
}

export async function deleteOwnerVehicleDocument(
  ownerUserId: string,
  documentId: string,
): Promise<{ error: Error | null }> {
  const { data: row, error: loadError } = await supabase()
    .from('owner_vehicle_documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId)
    .eq('status', 'current')
    .maybeSingle();
  if (loadError) return { error: new Error(loadError.message) };
  if (!row) return { error: new Error('Document not found') };

  const { error: updateError } = await supabase()
    .from('owner_vehicle_documents')
    .update({ status: 'deleted' })
    .eq('id', documentId)
    .eq('owner_user_id', ownerUserId);
  if (updateError) return { error: new Error(updateError.message) };

  if (row.storage_path) {
    await supabase().storage.from(BUCKET).remove([row.storage_path]);
    signedUrlCache.delete(row.storage_path);
  }
  return { error: null };
}
