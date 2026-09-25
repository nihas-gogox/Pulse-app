import type { ConversationPartyType, TripMessageRow } from "../types/chat.types";
import { mergeMessageMetadataForEventPayload } from "./eventPayloadMerge.util";
import { isEventVisibleForPartyLane, isLedgerLikeMessageType, type PartyLaneEvent } from "./messagePartyVisibility";

function normOrgId(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Sender / receiver org UUIDs from merged metadata (top-level or nested event_payload). */
export function readLedgerOrgIdsFromMessage(
  row: Partial<TripMessageRow>,
): { sender: string; receiver: string } | null {
  if (!isLedgerLikeMessageType(String(row.message_type))) return null;
  const merged = mergeMessageMetadataForEventPayload(row);
  if (!merged || typeof merged !== "object") return null;
  const top = merged as Record<string, unknown>;
  const ep = top.event_payload;
  const epObj = ep && typeof ep === "object" && !Array.isArray(ep) ? (ep as Record<string, unknown>) : null;
  const sender =
    normOrgId(top.sender_org_id) ||
    (epObj ? normOrgId(epObj.sender_org_id) : "");
  const receiver =
    normOrgId(top.receiver_org_id) ||
    (epObj ? normOrgId(epObj.receiver_org_id) : "");
  if (!sender || !receiver) return null;
  return { sender, receiver };
}

/** True when this org is a counterparty on the ledger row (strict; unknown metadata → false). */
export function ledgerEventInvolvesOrg(
  row: Partial<TripMessageRow>,
  orgId: string | null | undefined,
): boolean {
  if (!orgId?.trim()) return false;
  const ids = readLedgerOrgIdsFromMessage(row);
  if (!ids) return false;
  const o = orgId.trim();
  return ids.sender === o || ids.receiver === o;
}

/**
 * Signed amount from the viewer org's perspective: receiver = +inflow, sender = −outflow.
 */
export function ledgerSignedDeltaForViewer(
  row: Partial<TripMessageRow>,
  viewerOrgId: string,
): number | null {
  const ids = readLedgerOrgIdsFromMessage(row);
  if (!ids) return null;
  const v = viewerOrgId.trim();
  if (ids.sender !== v && ids.receiver !== v) return null;
  const merged = mergeMessageMetadataForEventPayload(row) as Record<string, unknown> | null;
  if (!merged) return null;
  const ep = merged.event_payload;
  const epObj = ep && typeof ep === "object" && !Array.isArray(ep) ? (ep as Record<string, unknown>) : null;
  const rawAmt = merged.amount ?? (epObj ? epObj.amount : undefined);
  const amount = Number(rawAmt);
  if (!Number.isFinite(amount)) return null;
  if (ids.receiver === v && ids.sender === v) return 0;
  if (ids.receiver === v) return amount;
  return -amount;
}

/**
 * Net ledger position for the viewer on the current lane: only rows visible in that tab
 * and where the viewer is sender or receiver.
 */
export function computeLaneLedgerBalance(
  events: ReadonlyArray<Partial<TripMessageRow> & { partyType?: ConversationPartyType }>,
  viewerOrgId: string,
  partyType: ConversationPartyType | null | undefined,
  laneConversationId: string | null | undefined,
): number | null {
  const v = viewerOrgId.trim();
  if (!v) return null;
  let sum = 0;
  let any = false;
  for (const raw of events) {
    if (!isLedgerLikeMessageType(String(raw.message_type))) continue;
    if (!ledgerEventInvolvesOrg(raw, v)) continue;
    if (partyType != null && laneConversationId) {
      const laneEvt = raw as PartyLaneEvent;
      if (!isEventVisibleForPartyLane(laneEvt, partyType, laneConversationId)) continue;
    }
    const d = ledgerSignedDeltaForViewer(raw, v);
    if (d == null) continue;
    any = true;
    sum += d;
  }
  if (!any && sum === 0) return null;
  return sum;
}
