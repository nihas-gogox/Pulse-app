import type { DocumentShareMetadata, TripMessageRow } from "../types/chat.types";

const IMAGE_EXT_RE =
  /\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tiff)(\?|#|$)/i;

export type DocumentShareDisplay = {
  documentName: string;
  documentType: string;
  extension: string;
  mimeType: string | null;
  storagePath: string;
  isImage: boolean;
};

export function parseDocumentShareMetadata(
  message: Pick<TripMessageRow, "metadata" | "content">,
): DocumentShareMetadata | null {
  const raw = message.metadata;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as DocumentShareMetadata;
    } catch {
      return null;
    }
  }
  return raw as DocumentShareMetadata;
}

function extensionFromName(name: string): string {
  const base = (name ?? "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toUpperCase();
}

function nameFromSharedContent(content: string | null | undefined): string | null {
  const m = (content ?? "").match(/^Shared document:\s*(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function isImageDocumentShare(
  meta: DocumentShareMetadata,
  storagePath: string,
): boolean {
  const mime = meta.mime_type?.trim().toLowerCase();
  if (mime?.startsWith("image/")) return true;
  const combined = `${meta.document_name ?? ""} ${storagePath}`.trim().toLowerCase();
  return IMAGE_EXT_RE.test(combined);
}

export function resolveDocumentShareDisplay(
  message: Pick<TripMessageRow, "metadata" | "content">,
): DocumentShareDisplay | null {
  const meta = parseDocumentShareMetadata(message);
  if (!meta) return null;

  const storagePath = String(meta.storage_path ?? "").trim();
  const documentName =
    (meta.document_name && String(meta.document_name).trim()) ||
    nameFromSharedContent(message.content) ||
    storagePath.split("/").pop() ||
    "Document";
  const documentType =
    String(meta.document_type ?? "Document").trim() || "Document";
  const extension =
    extensionFromName(documentName) ||
    (meta.mime_type?.includes("/")
      ? meta.mime_type.split("/").pop()?.toUpperCase() ?? ""
      : "");

  return {
    documentName,
    documentType,
    extension,
    mimeType: meta.mime_type ?? null,
    storagePath,
    isImage: isImageDocumentShare(meta, storagePath),
  };
}

/** Image file in trip / vehicle / driver document hub rows. */
export function isHubDocumentImage(doc: {
  label: string;
  mime_type?: string | null;
  storage_path?: string | null;
}): boolean {
  const mime = doc.mime_type?.trim().toLowerCase();
  if (mime?.startsWith("image/")) return true;
  const combined = `${doc.label ?? ""} ${doc.storage_path ?? ""}`.trim().toLowerCase();
  return IMAGE_EXT_RE.test(combined);
}

/** Accent for file-type icon tile (Slack-style). */
export function documentExtensionAccent(ext: string): string {
  const e = (ext ?? "").trim().toLowerCase();
  if (e === "pdf") return "#DC2626";
  if (e === "doc" || e === "docx") return "#2563EB";
  if (e === "xls" || e === "xlsx" || e === "csv") return "#059669";
  if (e === "ppt" || e === "pptx") return "#D97706";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(e)) return "#7C3AED";
  return "#64748B";
}
