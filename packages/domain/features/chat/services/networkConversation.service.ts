/**
 * Lightweight network DM helpers — safe to import from Story / Network UI
 * without pulling the full chat.service graph (compose, lanes, ratings, …).
 */
import { supabase } from "@pulse/core/lib/supabase";
import type {
  NetworkConversationRow,
  NetworkMessageRow,
} from "../types/chat.types";

const CONV_SELECT =
  "id,org_a_id,org_b_id,org_a_name,org_b_name,last_message_at,last_message_preview,unread_count_a,unread_count_b,created_at,updated_at";

const MSG_SELECT =
  "id, conversation_id, content, sender_org_id, sender_name, sender_user_id, created_at, is_read_by_other, read_at, metadata";

export async function getOrCreateNetworkConversation(params: {
  orgId: string;
  orgName: string;
  partnerOrgId: string;
  partnerOrgName: string;
}): Promise<NetworkConversationRow> {
  const { orgId, orgName, partnerOrgId, partnerOrgName } = params;
  // Canonical ordering ensures one row per pair
  const [aId, bId] = [orgId, partnerOrgId].sort();
  const [aName, bName] =
    aId === orgId ? [orgName, partnerOrgName] : [partnerOrgName, orgName];

  const { data: existing, error: selectError } = await supabase()
    .from("network_conversations")
    .select(CONV_SELECT)
    .eq("org_a_id", aId)
    .eq("org_b_id", bId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase()
    .from("network_conversations")
    .insert({
      org_a_id: aId,
      org_b_id: bId,
      org_a_name: aName,
      org_b_name: bName,
    })
    .select(CONV_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function sendNetworkMessage(params: {
  conversationId: string;
  senderOrgId: string;
  senderUserId: string | null;
  senderName: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}): Promise<NetworkMessageRow> {
  const {
    conversationId,
    senderOrgId,
    senderUserId,
    senderName,
    content,
    metadata,
  } = params;

  const { data, error } = await supabase()
    .from("network_messages")
    .insert({
      conversation_id: conversationId,
      sender_org_id: senderOrgId,
      sender_user_id: senderUserId,
      sender_name: senderName,
      content,
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    })
    .select(MSG_SELECT)
    .single();

  if (error) throw error;
  return data as NetworkMessageRow;
}
