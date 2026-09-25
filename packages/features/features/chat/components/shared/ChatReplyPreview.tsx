import { stripChatInlineMarkdown } from "../../utils/chatInlineMarkdown.util";
import { CornerUpLeft, X } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ReplyPreviewData = {
  messageId: string;
  senderName: string;
  content: string;
  messageType?: string | null;
};

function summarizeReplyContent(data: ReplyPreviewData): string {
  const t = data.messageType ?? "text";
  if (t === "story") {
    const raw = (data.content ?? "").trim();
    return raw ? `Story · ${raw.length > 80 ? raw.slice(0, 80) + "…" : raw}` : "Story";
  }
  if (t === "image") return "📷 Image";
  if (t === "document_share" || t === "document_upload") return "📎 Document";
  if (t === "status_change") return "🔄 Status update";
  if (t === "ledger_event" || t === "ledger" || t === "payment") return "💳 Payment";
  if (t === "feedback_request" || t === "feedback") return "⭐ Feedback";
  if (t === "tracking") return "📍 Location";
  const raw = stripChatInlineMarkdown((data.content ?? "").trim());
  if (!raw) return t.replace(/_/g, " ");
  return raw.length > 90 ? raw.slice(0, 90) + "…" : raw;
}

/** Strip shown inside the thread above the replied-to message body. */
export function ChatReplyThreadStrip({ reply }: { reply: ReplyPreviewData }) {
  return (
    <View style={strip.wrap}>
      <View style={strip.bar} />
      <View style={strip.body}>
        <Text style={strip.sender} numberOfLines={1}>
          {reply.senderName}
        </Text>
        <Text style={strip.content} numberOfLines={2}>
          {summarizeReplyContent(reply)}
        </Text>
      </View>
    </View>
  );
}

/** Banner shown above the composer when composing a reply. */
export function ChatReplyComposerBanner({
  reply,
  onCancel,
  variant = "mobile",
}: {
  reply: ReplyPreviewData;
  onCancel: () => void;
  variant?: "mobile" | "desktop";
}) {
  return (
    <View style={[banner.wrap, variant === "desktop" && banner.wrapDesktop]}>
      <CornerUpLeft size={13} color="#5B5EF4" strokeWidth={2.1} />
      <View style={banner.body}>
        <Text style={banner.sender} numberOfLines={1}>
          Replying to {reply.senderName}
        </Text>
        <Text style={banner.content} numberOfLines={1}>
          {summarizeReplyContent(reply)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onCancel}
        hitSlop={10}
        style={banner.cancelBtn}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
      >
        <X size={14} color="#9CA3AF" strokeWidth={1.65} />
      </TouchableOpacity>
    </View>
  );
}

// ── Thread strip styles ────────────────────────────────────────────────────────
const strip = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 7,
    marginBottom: 5,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#CBD5E1",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sender: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.05,
  },
  content: {
    fontSize: 11.5,
    color: "#6B7280",
    lineHeight: 15,
  },
});

// ── Composer banner styles ─────────────────────────────────────────────────────
const banner = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#F5F3FF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(91, 94, 244, 0.2)",
  },
  wrapDesktop: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: "rgba(91, 94, 244, 0.05)",
    borderTopColor: "rgba(91, 94, 244, 0.15)",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  sender: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5B5EF4",
    letterSpacing: 0.1,
  },
  content: {
    fontSize: 11.5,
    color: "#6B7280",
    lineHeight: 15,
    marginTop: 1,
  },
  cancelBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
