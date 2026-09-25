import { ChatAnimatedEmoji } from "./ChatAnimatedEmoji";
import {
  parseEmojiOnlyGlyphs,
  resolveJumboEmojiSize,
} from "@pulse/domain/features/chat/utils/chatEmojiAnim.util";
import { StyleSheet, View } from "react-native";

/** Large animated emoji row for emoji-only chat messages (Slack jumbo style). */
export function ChatJumboEmojiMessage({
  content,
  compact = false,
}: {
  content: string;
  /** Tighter vertical spacing when stacked under a sender header. */
  compact?: boolean;
}) {
  const glyphs = parseEmojiOnlyGlyphs(content);
  if (!glyphs) return null;

  const size = resolveJumboEmojiSize(glyphs.length);

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {glyphs.map((glyph, index) => (
        <ChatAnimatedEmoji key={`${glyph}-${index}`} emoji={glyph} size={size} />
      ))}
    </View>
  );
}

export function isJumboEmojiMessage(content: string): boolean {
  return parseEmojiOnlyGlyphs(content) !== null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  rowCompact: {
    marginTop: 0,
  },
});
