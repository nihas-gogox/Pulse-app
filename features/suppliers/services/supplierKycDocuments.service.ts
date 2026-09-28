import { supabase } from "@/lib/supabase";
import { uuidv7 } from "@/lib/uuidv7";
import type {
  SupplierKycDocument,
  SupplierKycDocType,
} from "@/features/suppliers/types/supplierManagement.types";

/** Same private bucket as fleet/driver compliance — first path segment is org id. */
export const SUPPLIER_KYC_BUCKET = "compliance-documents";
const SIGNED_URL_EXPIRY_SEC = 3600;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type UpsertSupplierKycDocData = {
  doc_type: SupplierKycDocType;
  doc_label?: string;
  doc_number?: string;
  storage_path?: string;
  file_name?: string;
  mime_type?: string;
  expiry_date?: string;
  is_mandatory?: boolean;
  notes?: string;
};

export type SupplierKycUploadFile = {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fileName: string;
};

function extFromNameOrMime(fileName: string, mimeType: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot > 0 && dot < fileName.length - 1) {
    return fileName.slice(dot + 1).toLowerCase();
  }
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

function normalizeMime(mimeType: string, fileName: string): string {
  const raw = (mimeType || "").toLowerCase().trim();
  if (raw === "image/jpg") return "image/jpeg";
  if (ALLOWED_MIME_TYPES.has(raw)) return raw;
  const ext = extFromNameOrMime(fileName, raw);
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return raw || "application/octet-stream";
}

export function validateSupplierKycFile(file: SupplierKycUploadFile): string | null {
  if (!file.arrayBuffer?.byteLength) return "File is empty.";
  if (file.arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }
  const mime = normalizeMime(file.mimeType, file.fileName);
  if (!ALLOWED_MIME_TYPES.has(mime) && mime !== "image/jpeg") {
    return "Unsupported file type. Please upload a JPG, PNG, WEBP, HEIC, or PDF.";
  }
  return null;
}

function buildStoragePath(
  orgId: string,
  supplierId: string,
  docType: SupplierKycDocType,
  ext: string,
): string {
  return `${orgId}/supplier/${supplierId}/${docType}_${uuidv7()}.${ext}`;
}

export async function getSupplierKycDocuments(
  orgId: string,
  supplierId: string,
): Promise<{ error: Error | null; documents: SupplierKycDocument[] }> {
  const { data, error } = await supabase()
    .from("supplier_kyc_documents")
    .select("*")
    .eq("organization_id", orgId)
    .eq("supplier_id", supplierId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return { error: new Error(error.message), documents: [] };
  return { error: null, documents: (data ?? []) as SupplierKycDocument[] };
}

export async function upsertSupplierKycDocument(
  orgId: string,
  supplierId: string,
  payload: UpsertSupplierKycDocData,
): Promise<{ error: Error | null; document: SupplierKycDocument | null }> {
  const { data: existingRows, error: findErr } = await supabase()
    .from("supplier_kyc_documents")
    .select("id, version_number")
    .eq("organization_id", orgId)
    .eq("supplier_id", supplierId)
    .eq("doc_type", payload.doc_type)
    .is("deleted_at", null)
    .order("version_number", { ascending: false })
    .limit(1);

  if (findErr) return { error: new Error(findErr.message), document: null };

  const existing = existingRows?.[0] as
    | { id: string; version_number: number }
    | undefined;

  if (existing?.id) {
    const { data, error } = await supabase()
      .from("supplier_kyc_documents")
      .update({
        ...payload,
        status: "pending",
        verified_at: null,
        verified_by: null,
        version_number: (existing.version_number ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return { error: new Error(error.message), document: null };
    return { error: null, document: data as SupplierKycDocument };
  }

  const { data, error } = await supabase()
    .from("supplier_kyc_documents")
    .insert({
      organization_id: orgId,
      supplier_id: supplierId,
      ...payload,
      status: "pending",
      version_number: 1,
    })
    .select()
    .single();
  if (error) return { error: new Error(error.message), document: null };
  return { error: null, document: data as SupplierKycDocument };
}

/** Adds another file of the same doc_type (multi-file sections) — never overwrites. */
export async function appendSupplierKycDocument(
  orgId: string,
  supplierId: string,
  payload: UpsertSupplierKycDocData,
): Promise<{ error: Error | null; document: SupplierKycDocument | null }> {
  const { data, error } = await supabase()
    .from("supplier_kyc_documents")
    .insert({
      organization_id: orgId,
      supplier_id: supplierId,
      ...payload,
      status: "pending",
      version_number: 1,
    })
    .select()
    .single();
  if (error) return { error: new Error(error.message), document: null };
  return { error: null, document: data as SupplierKycDocument };
}

/** Soft-deletes the row and removes its file from the bucket. */
export async function removeSupplierKycDocument(
  doc: Pick<SupplierKycDocument, "id" | "storage_path">,
): Promise<{ error: Error | null }> {
  const { error } = await supabase()
    .from("supplier_kyc_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", doc.id);
  if (error) return { error: new Error(error.message) };
  const path = (doc.storage_path ?? "").trim();
  if (path) {
    const { error: storageErr } = await supabase().storage.from(SUPPLIER_KYC_BUCKET).remove([path]);
    if (storageErr) return { error: new Error(storageErr.message) };
  }
  return { error: null };
}

export async function uploadSupplierKycFile(input: {
  orgId: string;
  supplierId: string;
  docType: SupplierKycDocType;
  docLabel?: string;
  docNumber?: string;
  isMandatory?: boolean;
  /** `replace` (default) keeps one row per doc_type; `append` adds another file. */
  mode?: "replace" | "append";
  file: SupplierKycUploadFile;
}): Promise<{ error: Error | null; document: SupplierKycDocument | null }> {
  const mimeType = normalizeMime(input.file.mimeType, input.file.fileName);
  const validation = validateSupplierKycFile({
    ...input.file,
    mimeType,
  });
  if (validation) return { error: new Error(validation), document: null };

  const ext = extFromNameOrMime(input.file.fileName, mimeType);
  const storagePath = buildStoragePath(
    input.orgId,
    input.supplierId,
    input.docType,
    ext,
  );

  const { error: uploadErr } = await supabase()
    .storage.from(SUPPLIER_KYC_BUCKET)
    .upload(storagePath, input.file.arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadErr) {
    return { error: new Error(uploadErr.message), document: null };
  }

  const save = input.mode === "append" ? appendSupplierKycDocument : upsertSupplierKycDocument;
  const { error, document } = await save(input.orgId, input.supplierId, {
    doc_type: input.docType,
    doc_label: input.docLabel,
    doc_number: input.docNumber,
    storage_path: storagePath,
    file_name: input.file.fileName,
    mime_type: mimeType,
    is_mandatory: input.isMandatory,
  });

  if (error || !document) {
    await supabase().storage.from(SUPPLIER_KYC_BUCKET).remove([storagePath]);
    return { error: error ?? new Error("Could not save document."), document: null };
  }

  return { error: null, document };
}

export async function getSupplierKycSignedUrl(
  storagePath: string,
): Promise<{ url: string | null; error: Error | null }> {
  if (!storagePath.trim()) {
    return { url: null, error: new Error("Missing storage path.") };
  }
  const { data, error } = await supabase()
    .storage.from(SUPPLIER_KYC_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SEC);
  if (error || !data?.signedUrl) {
    return { url: null, error: new Error(error?.message ?? "Could not open file.") };
  }
  return { url: data.signedUrl, error: null };
}

export async function updateSupplierKycDocumentStatus(
  docId: string,
  status: "pending" | "verified" | "rejected" | "expired",
): Promise<{ error: Error | null }> {
  const updates: Record<string, unknown> = { status };
  if (status === "verified") updates.verified_at = new Date().toISOString();
  const { error } = await supabase()
    .from("supplier_kyc_documents")
    .update(updates)
    .eq("id", docId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
