import {
    CHAT_TEXT_MUTED,
    CHAT_TEXT_PRIMARY,
    CHAT_TEXT_SECONDARY,
} from "@pulse/domain/features/chat/chatTheme";
import {
    extractDriverSwapNamesFromContent,
    stripChatPreviewEmojiPrefix,
} from "@pulse/domain/features/chat/utils/chatAvatar.util";
import { StyleSheet, Text, type TextStyle } from "react-native";

type Props = {
  text: string;
  style?: TextStyle;
  numberOfLines?: number;
};

/** Parsed driver-swap copy — muted lead, emphasized names (inbox + thread). */
export function ChatDriverSwapPreviewCopy({
  text,
  style,
  numberOfLines = 2,
}: Props) {
  const cleaned = stripChatPreviewEmojiPrefix(text);
  const { previousName, nextName } = extractDriverSwapNamesFromContent(cleaned);

  if (previousName && nextName) {
    return (
      <Text style={[styles.base, style]} numberOfLines={numberOfLines}>
        <Text style={styles.lead}>Driver changed from </Text>
        <Text style={styles.previousName}>{previousName}</Text>
        <Text style={styles.lead}> to </Text>
        <Text style={styles.nextName}>{nextName}</Text>
      </Text>
    );
  }

  if (nextName) {
    return (
      <Text style={[styles.base, style]} numberOfLines={numberOfLines}>
        <Text style={styles.lead}>Driver reassigned to </Text>
        <Text style={styles.nextName}>{nextName}</Text>
      </Text>
    );
  }

  return (
    <Text style={[styles.base, style]} numberOfLines={numberOfLines}>
      {cleaned || text}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  lead: {
    fontWeight: "400",
    color: CHAT_TEXT_SECONDARY,
  },
  previousName: {
    fontWeight: "500",
    color: CHAT_TEXT_MUTED,
  },
  nextName: {
    fontWeight: "600",
    color: CHAT_TEXT_PRIMARY,
  },
});
