import { supabase } from "@pulse/core/lib/supabase";
import { notifyTripChatMessagesChanged } from "../../../lib/tripChatInvalidate";
import type { LedgerEventMetadata } from "../types/chat.types";
import { getOrCreateConversation } from "./chat.service";

export interface PostLedgerEventParams {
  tripId: string;
  transactionId: string;
  amount: number;
  flow: "in" | "out";
  contactType: "client" | "supplier";
  contactId: string;
  category: string;
  paymentMode: string;
  referenceNumber?: string | null;
  notes?: string | null;
  senderOrgId: string;
  senderOrgName: string;
  receiverOrgId: string;
  receiverOrgName: string;
}

/**
 * Posts a ledger_event system card to all trip_conversations for the given trip
 * that involve integrated (linked) client or supplier parties.
 * Called from createLedgerEntry after a successful transaction insert.
 */
export async function postLedgerEventToChat(params: PostLedgerEventParams): Promise<void> {
  const {
    tripId, transactionId, amount, flow, category, paymentMode,
    contactType, contactId,
    referenceNumber, notes, senderOrgId, senderOrgName, receiverOrgId, receiverOrgName,
  } = params;

  // DB trigger may have already inserted this card (same transaction commits first).
  const { data: existingRow } = await supabase()
    .from("trip_messages")
    .select("id")
    .eq("message_type", "ledger_event")
    .contains("metadata", { transaction_id: transactionId })
    .maybeSingle();

  if (existingRow) return;

  const metadata: LedgerEventMetadata = {
    transaction_id: transactionId,
    amount,
    flow,
    category,
    payment_mode: paymentMode,
    reference_number: referenceNumber ?? null,
    notes: notes ?? null,
    sender_org_id: senderOrgId,
    sender_org_name: senderOrgName,
    receiver_org_id: receiverOrgId,
    receiver_org_name: receiverOrgName,
    acknowledged_at: null,
    disputed: false,
  };

  const amountLabel = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

  const content = flow === "in"
    ? `${senderOrgName} received ${amountLabel} · ${category}`
    : `${senderOrgName} paid ${amountLabel} to ${receiverOrgName} · ${category}`;

  // Ledger often runs before chat was opened; mirror DB trigger by ensuring a row exists.
  try {
    await getOrCreateConversation({
      tripId,
      organizationId: senderOrgId,
      partyType: contactType,
      partyId: contactId,
      partyName: receiverOrgName,
    });
  } catch {
    // Conversation may already exist with different party_name; continue to targeted select.
  }

  // Fetch source-org conversations for this trip and targeted party only.
  const { data: conversations, error } = await supabase()
    .from("trip_conversations")
    .select("id, organization_id, party_type, client_id, supplier_id")
    .eq("organization_id", senderOrgId)
    .eq("trip_id", tripId)
    .eq("party_type", contactType);

  if (error) {
    console.warn("[chatLedgerBridge] trip_conversations query failed", {
      tripId,
      senderOrgId,
      contactType,
      contactId,
      message: error.message,
    });
    return;
  }
  if (!conversations?.length) {
    console.warn("[chatLedgerBridge] no matching trip_conversation for ledger_event", {
      tripId,
      senderOrgId,
      contactType,
      contactId,
    });
    return;
  }

  for (const conv of conversations) {
    // Guard against posting to the wrong contact thread on the same trip.
    const isTargetConversation = contactType === "client"
      ? conv.client_id === contactId
      : conv.supplier_id === contactId;
    if (!isTargetConversation) continue;

    const { error: rpcError } = await supabase().rpc("send_trip_chat_message", {
      p_conversation_id: conv.id,
      p_content: content,
      p_sender_role: "system",
      p_sender_name: "Payment System",
      p_sender_user_id: null,
      p_message_type: "ledger_event",
      p_metadata: metadata,
    });

    if (!rpcError) continue;

    // Previously we only inserted when RPC was "missing". Any RPC failure (timeouts,
    // PostgREST hiccups, transient DB errors) must still try client insert + log.
    console.warn("[chatLedgerBridge] send_trip_chat_message failed, trying direct insert", {
      conversationId: conv.id,
      organizationId: conv.organization_id,
      tripId,
      transactionId,
      code: rpcError.code,
      message: rpcError.message,
    });

    const { error: fallbackError } = await supabase().from("trip_messages").insert({
      conversation_id: conv.id,
      organization_id: conv.organization_id,
      sender_user_id: null,
      sender_role: "system",
      sender_name: "Payment System",
      content,
      message_type: "ledger_event",
      is_read: false,
      metadata,
    });
    if (fallbackError) {
      console.warn("[chatLedgerBridge] direct ledger_event insert failed", {
        conversationId: conv.id,
        organizationId: conv.organization_id,
        tripId,
        transactionId,
        error: fallbackError.message,
      });
    }
  }
}

/**
 * Mirrors a ledger entry from chat into the receiver's own transactions ledger.
 * Called when receiver taps "Add to my book" on a ledger card.
 *
 * Idempotent: `chat_mirror_of_transaction_id` + unique index (migration) ensures
 * one row per receiver org per source `transaction_id`. Duplicate taps / races
 * return success without a second insert.
 */
export async function mirrorLedgerEntryFromChat(
  metadata: LedgerEventMetadata,
  receiverOrgId: string,
  tripId: string | null
): Promise<{ error: Error | null }> {
  const isReceiver = metadata.receiver_org_id === receiverOrgId;
  const amountIn = isReceiver ? metadata.amount : 0;
  const amountOut = isReceiver ? 0 : metadata.amount;

  const description = [
    metadata.category,
    `Mode: ${metadata.payment_mode}`,
    metadata.reference_number ? `UTR: ${metadata.reference_number}` : null,
    metadata.notes ? `Notes: ${metadata.notes}` : null,
    `Mirrored from: ${metadata.sender_org_name}`,
  ].filter(Boolean).join(" | ");

  const sourceTxId = String(metadata.transaction_id ?? "").trim();
  const mirrorPayload = {
    organization_id: receiverOrgId,
    trip_id: tripId,
    party_name: isReceiver ? metadata.sender_org_name : metadata.receiver_org_name,
    description,
    amount_in: amountIn,
    amount_out: amountOut,
    transaction_date: new Date().toISOString().slice(0, 10),
    contact_type: null as string | null,
    contact_id: null as string | null,
    ...(sourceTxId ? { chat_mirror_of_transaction_id: sourceTxId } : {}),
  };

  if (sourceTxId) {
    const { data: existing } = await supabase()
      .from("transactions")
      .select("id")
      .eq("organization_id", receiverOrgId)
      .eq("chat_mirror_of_transaction_id", sourceTxId)
      .maybeSingle();
    if (existing?.id) {
      notifyTripChatMessagesChanged();
      return { error: null };
    }
  }

  const { error } = await supabase().from("transactions").insert(mirrorPayload);

  if (error) {
    // Unique violation: another tab/device already mirrored this source tx.
    if (error.code === "23505" && sourceTxId) {
      notifyTripChatMessagesChanged();
      return { error: null };
    }
    return { error: new Error(error.message) };
  }
  notifyTripChatMessagesChanged();
  return { error: null };
}

/**
 * Atomically books a ledger chat message (accounting_books + mirrored transaction + metadata).
 */
export async function confirmLedgerToAccountingBooks(
  messageId: string,
  orgId: string,
): Promise<{ error: Error | null; data: Record<string, unknown> | null }> {
  const { data, error } = await supabase().rpc("confirm_to_accounting_books", {
    p_message_id: messageId,
    p_org_id: orgId,
  });

  if (error) {
    return { error: new Error(error.message), data: null };
  }

  notifyTripChatMessagesChanged();

  const row = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  return { error: null, data: row };
}

/**
 * Marks a ledger_event message as acknowledged (add-to-book confirmed).
 */
export async function acknowledgeLedgerEventMessage(
  messageId: string,
  conversationId: string
): Promise<void> {
  const acknowledgedAt = new Date().toISOString();

  const { error } = await supabase().rpc("acknowledge_ledger_messages_for_transaction", {
    p_message_id: messageId,
    p_conversation_id: conversationId,
    p_acknowledged_at: acknowledgedAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Marks a ledger_event message as disputed.
 */
export async function disputeLedgerEventMessage(messageId: string): Promise<void> {
  const { data: msg } = await supabase()
    .from("trip_messages")
    .select("metadata")
    .eq("id", messageId)
    .single();

  if (!msg) return;

  await supabase()
    .from("trip_messages")
    .update({ metadata: { ...(msg.metadata ?? {}), disputed: true } })
    .eq("id", messageId);
}
