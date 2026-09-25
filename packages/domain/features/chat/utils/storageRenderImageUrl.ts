/**
 * Guards for chat image URLs taken from message metadata.
 *
 * Every chat bucket is private, so any `/public/` Storage URL returns
 * 400 NoSuchBucket. Older messages may still carry one in `metadata.thumb_url`;
 * these predicates keep such URLs from ever reaching `<Image>`.
 *
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */

/** Default bucket for trip chat uploads after path normalization. */
export const TRIP_CHAT_IMAGE_BUCKET = "trip-documents" as const;

/**
 * Any public Storage URL — both `/object/public/…` and `/render/image/public/…`.
 * Both 400 on the private chat buckets, so neither is usable as a first paint.
 */
export function isSupabasePublicRenderImageUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  return /\/storage\/v1\/(object|render\/image)\/public\//i.test(u);
}

/** True for imgproxy URLs, which return 403 FeatureNotEnabled on this tenant. */
export function isSupabaseRenderTransformUrl(url: string | null | undefined): boolean {
  return /\/storage\/v1\/render\/image\//i.test(String(url ?? "").trim());
}

/** HTTPS URLs safe to pass directly to `<Image>` — signed object URLs only. */
export function isDirectChatImageHttpUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (isSupabasePublicRenderImageUrl(u)) return false;
  return !isSupabaseRenderTransformUrl(u);
}

/** Ensures transformation query params exist (WhatsApp-style thin fetches). */
export function appendImageTransformQuery(url: string, width: number, quality: number): string {
  const u = String(url ?? "").trim();
  if (!u.startsWith("http")) return u;
  // Mutating signed URLs breaks the signature → 403 + endless spinner.
  if (
    /[?&]token=/i.test(u) ||
    /\/object\/sign\//i.test(u) ||
    /\/render\/image\/sign\//i.test(u)
  ) {
    return u;
  }
  try {
    const parsed = new URL(u);
    if (!parsed.searchParams.has("width")) {
      parsed.searchParams.set("width", String(Math.max(16, Math.round(width))));
    }
    if (!parsed.searchParams.has("quality")) {
      parsed.searchParams.set("quality", String(Math.min(100, Math.max(1, Math.round(quality)))));
    }
    return parsed.toString();
  } catch {
    const join = u.includes("?") ? "&" : "?";
    return `${u}${join}width=${Math.max(16, Math.round(width))}&quality=${Math.min(100, Math.max(1, Math.round(quality)))}`;
  }
}
