import { ChatAnimatedEmoji } from "./ChatAnimatedEmoji";
import {
  CHAT_ACCENT,
  CHAT_ACCENT_BORDER,
  CHAT_ACCENT_SOFT,
  CHAT_TEXT_SECONDARY,
} from "@pulse/domain/features/chat/chatTheme";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ChatReactions = Record<string, string[]>;

type ReactionEntry = {
  emoji: string;
  count: number;
  hasOwn: boolean;
};

function parseReactions(
  reactions: ChatReactions | null | undefined,
  selfUserId: string | null | undefined,
): ReactionEntry[] {
  if (!reactions) return [];
  return Object.entries(reactions)
    .filter(([, users]) => Array.isArray(users) && users.length > 0)
    .map(([emoji, users]) => ({
      emoji,
      count: users.length,
      hasOwn: selfUserId ? users.includes(selfUserId) : false,
    }));
}

export function ChatReactionsRow({
  reactions,
  selfUserId,
  onToggle,
  avatarOffset = 36,
  variant = "mobile",
  align = "left",
}: {
  reactions: ChatReactions | null | undefined;
  selfUserId: string | null | undefined;
  onToggle: (emoji: string) => void;
  avatarOffset?: number;
  variant?: "mobile" | "desktop";
  align?: "left" | "right";
}) {
  const entries = parseReactions(reactions, selfUserId);
  if (entries.length === 0) return null;

  const compact = variant === "desktop";

  return (
    <View
      style={[
        styles.row,
        align === "right"
          ? styles.rowRight
          : { marginLeft: avatarOffset },
      ]}
    >
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.emoji}
          style={[
            styles.chip,
            compact && styles.chipCompact,
            entry.hasOwn ? styles.chipOwn : styles.chipDefault,
          ]}
          onPress={() => onToggle(entry.emoji)}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`${entry.emoji} ${entry.count} reaction${entry.count > 1 ? "s" : ""}`}
        >
          <View style={[styles.emojiSlot, compact && styles.emojiSlotCompact]}>
            <ChatAnimatedEmoji emoji={entry.emoji} size="xs" loop={false} />
          </View>
          <Text
            style={[
              styles.count,
              compact && styles.countCompact,
              entry.hasOwn && styles.countOwn,
            ]}
          >
            {entry.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const CHIP_SHADOW =
  Platform.OS === "web"
    ? ({ boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" } as object)
    : Platform.select({
        ios: {
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
        },
        android: { elevation: 1 },
        default: {},
      });

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 5,
    marginBottom: 2,
  },
  rowRight: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
    maxWidth: "82%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 4,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    ...CHIP_SHADOW,
  },
  chipCompact: {
    minHeight: 24,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 2,
    gap: 3,
  },
  chipDefault: {
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  chipOwn: {
    borderColor: CHAT_ACCENT_BORDER,
    backgroundColor: CHAT_ACCENT_SOFT,
  },
  emojiSlot: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emojiSlotCompact: {
    width: 16,
    height: 16,
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: CHAT_TEXT_SECONDARY,
    lineHeight: 14,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
    minWidth: 10,
    textAlign: "center",
  },
  countCompact: {
    fontSize: 11,
    lineHeight: 13,
    minWidth: 8,
  },
  countOwn: {
    color: CHAT_ACCENT,
  },
});
