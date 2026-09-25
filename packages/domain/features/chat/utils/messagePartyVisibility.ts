import type { ConversationPartyType, MessageType } from "../types/chat.types";

/** Merged event_stream row shape for party-lane filtering. */
export type PartyLaneEvent = {
  message_type?: MessageType | string;
  conversation_id?: string;
  visibility_tags?: string[] | null;
  metadata?: unknown;
  partyType: ConversationPartyType;
};

export function isLedgerLikeMessageType(mt: string | undefined): boolean {
  return mt === "ledger_event" || mt === "ledger" || mt === "payment" || mt === "ledger_update";
}

/**
 * Whether a merged `event_stream` row belongs in one party lane (sidebar + detail).
 *
 * Ledger / payment rows are persisted per `trip_conversations` row. Unified bootstrap
 * historically tagged them with every client+supplier conv id, which made supplier-only
 * payments visible in the client tab. Those types are always scoped to
 * `event.conversation_id ===` this lane's conversation id.
 */
export function isEventVisibleForPartyLane(
  event: PartyLaneEvent,
  partyType: ConversationPartyType,
  convId: string | undefined,
): boolean {
  const mt = event.message_type as string | undefined;
  if (isLedgerLikeMessageType(mt)) {
    const meta =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;
    const vt = meta?.visible_to;
    if (Array.isArray(vt) && vt.length > 0) {
      return vt.some((x) => String(x).toLowerCase() === partyType);
    }
    if (convId && event.conversation_id) return event.conversation_id === convId;
    return event.partyType === partyType;
  }
  if (mt === "document_upload") {
    if (convId && event.conversation_id) return event.conversation_id === convId;
    return event.partyType === partyType;
  }
  const tags = event.visibility_tags;
  if (tags && tags.length > 0) {
    return (convId ? tags.includes(convId) : false) || tags.includes(partyType);
  }
  return event.partyType === partyType;
}
