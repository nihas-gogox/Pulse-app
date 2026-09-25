/**
 * Long-press / right-click context menu for a chat message.
 * Shows quick emoji reactions + action buttons (Reply, Copy).
 */
import { Copy, CornerUpLeft, Pencil, Plus, Trash2 } from "lucide-react-native";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { ChatAnimatedEmoji } from "./ChatAnimatedEmoji";
import { CHAT_QUICK_REACTION_EMOJIS } from "@pulse/domain/features/chat/utils/chatEmojiAnim.util";

export type MessageContextMenuProps = {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  /** Whether to show the full emoji picker trigger (future). */
  showMoreReactions?: boolean;
  /** Show Edit/Delete only for the sender's own messages. */
  isOwn?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function ChatMessageContextMenu({
  visible,
  onClose,
  onReact,
  onReply,
  onCopy,
  showMoreReactions = true,
  isOwn = false,
  onEdit,
  onDelete,
}: MessageContextMenuProps) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType={Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.menu} onPress={() => {}}>
          {/* Quick reactions row */}
          <View style={styles.reactionsRow}>
            {CHAT_QUICK_REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => {
                  onReact(emoji);
                  onClose();
                }}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
              >
                <ChatAnimatedEmoji emoji={emoji} size="xl" />
              </TouchableOpacity>
            ))}
            {showMoreReactions ? (
              <TouchableOpacity
                style={[styles.reactionBtn, styles.moreBtnWrap]}
                onPress={onClose}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="More reactions"
              >
                <Plus size={14} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Action buttons */}
          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              onReply();
              onClose();
            }}
            activeOpacity={0.82}
          >
            <CornerUpLeft size={16} color="#374151" strokeWidth={1.65} />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, !isOwn && styles.actionLast]}
            onPress={() => {
              onCopy();
              onClose();
            }}
            activeOpacity={0.82}
          >
            <Copy size={16} color="#374151" strokeWidth={1.65} />
            <Text style={styles.actionText}>Copy text</Text>
          </TouchableOpacity>

          {isOwn && onEdit ? (
            <TouchableOpacity
              style={styles.action}
              onPress={() => {
                onEdit();
                onClose();
              }}
              activeOpacity={0.82}
            >
              <Pencil size={16} color="#374151" strokeWidth={1.65} />
              <Text style={styles.actionText}>Edit message</Text>
            </TouchableOpacity>
          ) : null}

          {isOwn && onDelete ? (
            <TouchableOpacity
              style={[styles.action, styles.actionLast]}
              onPress={() => {
                onDelete();
                onClose();
              }}
              activeOpacity={0.82}
            >
              <Trash2 size={16} color="#ef4444" strokeWidth={1.65} />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Delete message</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    width: 256,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
    overflow: "hidden",
  },
  reactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 2,
  },
  reactionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    minHeight: 52,
  },
  moreBtnWrap: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  actionLast: {
    borderBottomWidth: 0,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1C1D",
    letterSpacing: 0.02,
  },
  actionTextDanger: {
    color: "#ef4444",
  },
});

// ── Desktop hover action toolbar ──────────────────────────────────────────────

export type HoverActionItem = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
};

export function ChatMessageHoverActions({
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onHoverIn,
  onHoverOut,
}: {
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}) {
  // onHoverIn/onHoverOut are RN Web View responders not present in RN View types.
  const hoverProps = { onHoverIn, onHoverOut } as object;
  return (
    <View style={hover.wrap} {...hoverProps}>
      {/* Quick reaction buttons */}
      {CHAT_QUICK_REACTION_EMOJIS.slice(0, 3).map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={[hover.btn, !onReact && hover.btnDisabled]}
          onPress={() => onReact?.(emoji)}
          activeOpacity={0.75}
          disabled={!onReact}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
        >
          <ChatAnimatedEmoji emoji={emoji} size="sm" />
        </TouchableOpacity>
      ))}
      <View style={hover.sep} />
      <TouchableOpacity
        style={[hover.btn, !onReply && hover.btnDisabled]}
        onPress={() => onReply?.()}
        activeOpacity={0.75}
        disabled={!onReply}
        accessibilityRole="button"
        accessibilityLabel="Reply"
      >
        <CornerUpLeft size={13} color="#6B7280" strokeWidth={1.65} />
      </TouchableOpacity>
      <TouchableOpacity
        style={hover.btn}
        onPress={onCopy}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Copy"
      >
        <Copy size={13} color="#6B7280" strokeWidth={1.65} />
      </TouchableOpacity>
      {onEdit ? (
        <>
          <View style={hover.sep} />
          <TouchableOpacity
            style={hover.btn}
            onPress={onEdit}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Edit"
          >
            <Pencil size={13} color="#6B7280" strokeWidth={1.65} />
          </TouchableOpacity>
        </>
      ) : null}
      {onDelete ? (
        <TouchableOpacity
          style={hover.btn}
          onPress={onDelete}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Trash2 size={13} color="#ef4444" strokeWidth={1.65} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const hover = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: -20,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    zIndex: 10,
  },
  btn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  sep: {
    width: 1,
    height: 18,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 2,
  },
});
