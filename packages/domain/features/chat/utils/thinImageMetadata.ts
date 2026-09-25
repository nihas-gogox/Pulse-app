import type { TripMessageRow } from "../types/chat.types";

export type ThinImagePayload = {
  /** Pre-built HTTPS URL (e.g. from insert RPC) — zero client Storage calls. */
  thumbUrl?: string;
  blurhash?: string;
  thumbhash?: string;
  /** Tiny data-URL placeholder while CDN thumbnail loads. */
  thumbDataUri?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Read optional thin-image fields from trip_messages.metadata (or event_payload). */
export function extractThinImagePayload(
  message?: Pick<TripMessageRow, "metadata"> | null,
): ThinImagePayload {
  if (!message?.metadata) return {};
  let raw: unknown = message.metadata;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  const o = asRecord(raw);
  if (!o) return {};
  const ep = asRecord(o.event_payload);

  const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : undefined);

  return {
    thumbUrl:
      str(o.thumb_url) ??
      str(o.public_thumb_url) ??
      str(o.thumbnail_url) ??
      str(ep?.thumb_url) ??
      str(ep?.public_thumb_url),
    blurhash: str(o.blurhash) ?? str(o.thumb_blurhash) ?? str(ep?.blurhash) ?? str(ep?.thumb_blurhash),
    thumbhash: str(o.thumbhash) ?? str(ep?.thumbhash),
    thumbDataUri: str(o.thumb_data_uri) ?? str(o.placeholder_data_uri) ?? str(ep?.thumb_data_uri),
  };
}
