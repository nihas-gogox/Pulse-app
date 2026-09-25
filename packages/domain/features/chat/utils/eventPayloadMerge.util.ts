import type { TripMessageRow } from "../types/chat.types";

/**
 * Merge top-level `row.event_payload` (if present) into metadata for patch resolution
 * and UI (system_log location_data, action_id, etc.).
 */
export function mergeMessageMetadataForEventPayload(
  row: Partial<TripMessageRow>,
): Record<string, unknown> | null {
  const base = row.metadata;
  const topEp = row.event_payload;
  const baseObj =
    base && typeof base === "object" && !Array.isArray(base)
      ? ({ ...(base as object) } as Record<string, unknown>)
      : null;
  if (topEp && typeof topEp === "object" && !Array.isArray(topEp)) {
    const prevEp =
      baseObj?.event_payload &&
      typeof baseObj.event_payload === "object" &&
      !Array.isArray(baseObj.event_payload)
        ? (baseObj.event_payload as object)
        : {};
    return {
      ...(baseObj ?? {}),
      event_payload: { ...prevEp, ...(topEp as object) } as Record<string, unknown>,
    };
  }
  return baseObj;
}
