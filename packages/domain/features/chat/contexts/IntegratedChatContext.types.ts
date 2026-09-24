// Types extracted from features/chat/contexts/IntegratedChatContext.tsx (driver extraction, Phase 2, D19). Types only — no runtime code.

// ── Backward-compatible shape for ChatScreen ──────────────────────────────────

export interface DirectMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  /** WhatsApp-style quoted preview (e.g. replied-to story). */
  replyPreview?: {
    messageId: string;
    senderName: string;
    content: string;
    messageType?: string | null;
  } | null;
}

export interface IntegratedChat {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerPartyType?: "client" | "supplier";
  partnerLogoUrl?: string | null;
  partnerAvatarSeed?: string | null;
  partnerRole: "dispatcher" | "owner";
  organization: string;
  isOnline: boolean;
  messages: DirectMessage[];
  lastActivity: string;
  unreadCount: number;
}
