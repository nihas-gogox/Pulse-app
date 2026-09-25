import type { TripMessageRow } from "../types/chat.types";
import { mergeMessageMetadataForEventPayload } from "./eventPayloadMerge.util";

type StreamRow = TripMessageRow & { partyType?: string };

export function isLongHaulLateChatMessage(message: Partial<TripMessageRow>): boolean {
  if (message.message_type !== "system_log") return false;
  const m = message.metadata as Record<string, unknown> | null | undefined;
  if (m?.long_haul_late === true) return true;
  const ep =
    m?.event_payload && typeof m.event_payload === "object" && !Array.isArray(m.event_payload)
      ? (m.event_payload as Record<string, unknown>)
      : null;
  return String(ep?.event_tag ?? "").toUpperCase() === "LATE";
}

export function readLongHaulMetaFromMessage(message: Partial<TripMessageRow>): {
  newEta: string | null;
  originalEta: string | null;
  health: string | null;
} {
  const m = message.metadata as Record<string, unknown> | null | undefined;
  const ep =
    m?.event_payload && typeof m.event_payload === "object" && !Array.isArray(m.event_payload)
      ? (m.event_payload as Record<string, unknown>)
      : null;
  const newEta = typeof ep?.new_eta === "string" ? ep.new_eta.trim() : null;
  const originalEta =
    typeof ep?.original_eta === "string" ? ep.original_eta.trim() : null;
  const health = typeof ep?.health_status === "string" ? ep.health_status.trim() : null;
  return {
    newEta: newEta || null,
    originalEta: originalEta || null,
    health: health || null,
  };
}

function readOptionalEtaHealthFromRow(row: StreamRow): { eta?: string; health?: string } {
  const m = mergeMessageMetadataForEventPayload(row) as Record<string, unknown> | null;
  const ep = m?.event_payload as Record<string, unknown> | undefined;
  if (!ep || typeof ep !== "object") return {};
  const eta = typeof ep.new_eta === "string" && ep.new_eta.trim() ? ep.new_eta.trim() : undefined;
  const health =
    typeof ep.health_status === "string" && ep.health_status.trim()
      ? ep.health_status.trim()
      : undefined;
  return { eta, health };
}

/**
 * Rolling long-haul display fields for the trip entry + Late card:
 * newest LATE system_log sets baseline; any later `location_log` rows may carry
 * `event_payload.new_eta` / `health_status` (forward-compatible with richer pings).
 */
export function recomputeLongHaulTripFieldsFromStream(eventStream: StreamRow[]): {
  trackingStatus: string | null;
  longHaulRevisedEta: string | null;
  longHaulHealthStatus: string | null;
} {
  let lastLateIdx = -1;
  for (let i = eventStream.length - 1; i >= 0; i--) {
    const m = eventStream[i]!;
    if (m.message_type === "system_log" && isLongHaulLateChatMessage(m)) {
      lastLateIdx = i;
      break;
    }
  }
  if (lastLateIdx < 0) {
    return { trackingStatus: null, longHaulRevisedEta: null, longHaulHealthStatus: null };
  }
  const lateMsg = eventStream[lastLateIdx]!;
  const base = readLongHaulMetaFromMessage(lateMsg);
  let longHaulRevisedEta = base.newEta;
  let longHaulHealthStatus = base.health;
  for (let i = lastLateIdx + 1; i < eventStream.length; i++) {
    const m = eventStream[i]!;
    if (m.message_type !== "location_log") continue;
    const extra = readOptionalEtaHealthFromRow(m);
    if (extra.eta) longHaulRevisedEta = extra.eta;
    if (extra.health) longHaulHealthStatus = extra.health;
  }
  return {
    trackingStatus: "RUNNING_LATE",
    longHaulRevisedEta,
    longHaulHealthStatus,
  };
}
