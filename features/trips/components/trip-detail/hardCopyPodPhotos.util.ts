import { VAULT_DOC_MAX_BYTES, VAULT_DOC_MAX_MB } from "@/features/trips/components/trip-detail/tripDocTypes";

/** Image types accepted on the Hard Copy POD photo picker. */
export const HARD_COPY_POD_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const POD_PHOTO_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const POD_PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export type HardCopyPodPhotoCandidate = {
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

function fileLabel(file: HardCopyPodPhotoCandidate): string {
  return file.fileName?.trim() || file.name?.trim() || "A file";
}

function extensionOf(file: HardCopyPodPhotoCandidate): string {
  return fileLabel(file).split(".").pop()?.toLowerCase() ?? "";
}

export function isHardCopyPodPhoto(file: HardCopyPodPhotoCandidate): boolean {
  const ext = extensionOf(file);
  if (POD_PHOTO_EXT.has(ext)) return true;
  const mime = (file.mimeType ?? "").toLowerCase().trim();
  return POD_PHOTO_MIME.has(mime);
}

/**
 * Rejects unsupported types and files over the existing trip-document size limit.
 * Does not cap how many photos can be attached.
 */
export function hardCopyPodPhotoRejectionMessage(
  assets: HardCopyPodPhotoCandidate[],
): string | null {
  if (assets.length === 0) return null;
  const parts: string[] = [];
  const oversized = assets.filter(
    (asset) => typeof asset.size === "number" && asset.size > VAULT_DOC_MAX_BYTES,
  );
  if (oversized.length > 0) {
    const names = oversized.map(fileLabel).join(", ");
    parts.push(
      `${names} ${oversized.length === 1 ? "exceeds" : "exceed"} ${VAULT_DOC_MAX_MB} MB. Each photo must be ${VAULT_DOC_MAX_MB} MB or smaller.`,
    );
  }
  const unsupported = assets.filter((asset) => !isHardCopyPodPhoto(asset));
  if (unsupported.length > 0) {
    const names = unsupported.map(fileLabel).join(", ");
    parts.push(
      `${names} ${unsupported.length === 1 ? "is" : "are"} not supported. Use JPG, JPEG, PNG, or WEBP.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

export function shortHardCopyPodPhotoName(name: string): string {
  const trimmed = name.trim() || "POD photo";
  if (trimmed.length <= 18) return trimmed;
  const dot = trimmed.lastIndexOf(".");
  const ext = dot > 0 ? trimmed.slice(dot) : "";
  const base = (dot > 0 ? trimmed.slice(0, dot) : trimmed).trim();
  const keep = Math.max(6, 14 - ext.length);
  return `${base.slice(0, keep)}…${ext}`;
}
