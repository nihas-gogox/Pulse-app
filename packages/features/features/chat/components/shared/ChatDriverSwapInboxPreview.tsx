import type { DriverSwapPair } from "@pulse/domain/features/chat/utils/chatAvatar.util";
import { StyleSheet, View } from "react-native";
import { slackDesktopStyles as deskSt } from "@pulse/domain/features/chat/components/desktop/chatSlackDesktop.styles";
import { slackMobileStyles as mobileSt } from "@pulse/domain/features/chat/components/mobile/chatSlackMobile.styles";
import { ChatDriverSwapAvatarCompact } from "./ChatDriverSwapAvatarCompact";
import { ChatDriverSwapPreviewCopy } from "./ChatDriverSwapPreviewCopy";

/** Inbox row driver swap — inline with flat list rows (no nested card). */
export function ChatDriverSwapInboxPreview({
  swap,
  text,
  variant = "mobile",
}: {
  swap: DriverSwapPair;
  text: string;
  variant?: "mobile" | "desktop";
}) {
  const textStyle = variant === "desktop" ? deskSt.sidebarRowPreview : mobileSt.listRowPreview;

  return (
    <View style={styles.row}>
      <ChatDriverSwapAvatarCompact swap={swap} />
      <View style={styles.copyWrap}>
        <ChatDriverSwapPreviewCopy text={text} style={textStyle} numberOfLines={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    minWidth: 0,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
});
