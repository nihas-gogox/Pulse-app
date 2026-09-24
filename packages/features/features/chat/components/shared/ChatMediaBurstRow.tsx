import { ChatPartyAvatar } from "../ChatPartyAvatar";
import { ChatReactionsRow, type ChatReactions } from "./ChatReactionsRow";
import { ChatReplyThreadStrip, type ReplyPreviewData } from "./ChatReplyPreview";
import { ChatThreadMediaStrip } from "./ChatThreadMediaStrip";
import type { ChatMediaBurstLeader } from "@pulse/domain/features/chat/utils/chatMediaBurst.util";
import type { SlackMessageGroupMeta } from "@pulse/domain/features/chat/utils/slackMessageGroup.util";
import type { ResolvedPartyAvatarIdentity } from "@pulse/domain/lib/entityIdentity.types";
import { renderChatInlineMarkdown } from "../../utils/chatInlineMarkdown.util";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  slackDesktopStyles as deskSt,
  SLACK_DESKTOP_AVATAR,
} from "@pulse/domain/features/chat/components/desktop/chatSlackDesktop.styles";
import {
  SLACK_AVATAR,
  slackMobileStyles as st,
} from "@pulse/domain/features/chat/components/mobile/chatSlackMobile.styles";

export type ChatMediaBurstRowProps = {
  burst: ChatMediaBurstLeader;
  senderName: string;
  timestamp: string;
  avatar: ResolvedPartyAvatarIdentity;
  isOwn?: boolean;
  userAvatarUrl?: string | null;
  userAvatarSeed?: string | null;
  userOrgLogoUrl?: string | null;
  userName?: string;
  onAvatarPress?: () => void;
  variant?: "mobile" | "desktop";
  group?: SlackMessageGroupMeta;
  reactions?: ChatReactions | null;
  selfUserId?: string | null;
  onReact?: (emoji: string) => void;
  replyPreview?: ReplyPreviewData | null;
  isNew?: boolean;
};

export function ChatMediaBurstRow({
  burst,
  senderName,
  timestamp,
  avatar,
  isOwn,
  userAvatarUrl,
  userAvatarSeed,
  userOrgLogoUrl,
  userName,
  onAvatarPress,
  variant = "mobile",
  group,
  reactions,
  selfUserId,
  onReact,
  replyPreview,
  isNew,
}: ChatMediaBurstRowProps) {
  const styles = variant === "desktop" ? deskSt : st;
  const avatarSize = variant === "desktop" ? SLACK_DESKTOP_AVATAR.message : SLACK_AVATAR.thread;
  const showHeader = group?.showHeader ?? true;
  const showAvatar = group?.showAvatar ?? true;
  const isContinuation = group?.isContinuation ?? false;
  const caption = burst.captionText.trim();

  const wasNewRef = useRef(isNew === true);
  const wasNew = wasNewRef.current;
  const enterOpacity = useRef(new Animated.Value(wasNew ? 0 : 1)).current;
  const enterY = useRef(new Animated.Value(wasNew ? 8 : 0)).current;

  useEffect(() => {
    if (!wasNew) return;
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let displayTime = timestamp;
  try {
    displayTime = new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    // keep raw
  }

  const avatarNode = (
    <View style={styles.threadMsgAvatarCircle}>
      <ChatPartyAvatar
        identity={avatar}
        size={avatarSize}
        isOwnUser={isOwn}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        userAvatarSeed={userAvatarSeed}
        userOrgLogoUrl={userOrgLogoUrl}
      />
    </View>
  );

  const avatarColumn = showAvatar ? (
    onAvatarPress ? (
      <Pressable onPress={onAvatarPress} hitSlop={6}>
        {avatarNode}
      </Pressable>
    ) : (
      avatarNode
    )
  ) : (
    <View style={[styles.threadMsgAvatarSpacer, { width: avatarSize }]} />
  );

  return (
    <Animated.View
      style={{
        opacity: enterOpacity,
        transform: [{ translateY: enterY }],
      }}
    >
      {replyPreview ? (
        <View style={{ paddingLeft: avatarSize + 6 }}>
          <ChatReplyThreadStrip reply={replyPreview} />
        </View>
      ) : null}

      <View
        style={[
          styles.threadMsgRow,
          isContinuation ? styles.threadMsgRowContinuation : styles.threadMsgRowLead,
          group?.partyBreak && styles.threadMsgRowPartyBreak,
        ]}
      >
        {avatarColumn}
        <View style={styles.threadMsgBody}>
          {showHeader ? (
            <View style={styles.threadMsgHeader}>
              <Text style={styles.threadMsgName} numberOfLines={1}>
                {senderName}
              </Text>
              <Text style={styles.threadMsgTime} numberOfLines={1}>
                {displayTime}
              </Text>
            </View>
          ) : null}

          <ChatThreadMediaStrip items={burst.imageItems} />

          {caption ? (
            <Text
              style={[
                styles.threadMsgText,
                { marginTop: 6 },
                isContinuation && styles.threadMsgTextContinuation,
                !showHeader && styles.threadMsgTextStacked,
              ]}
            >
              {renderChatInlineMarkdown(caption)}
            </Text>
          ) : null}
        </View>
      </View>

      {reactions && onReact ? (
        <ChatReactionsRow
          reactions={reactions}
          selfUserId={selfUserId}
          onToggle={onReact}
          avatarOffset={avatarSize + 6}
          variant={variant}
        />
      ) : null}
    </Animated.View>
  );
}
