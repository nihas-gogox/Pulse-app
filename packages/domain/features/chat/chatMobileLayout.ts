/**
 * Mobile chat layout tokens — Metronic demo2 density (compact typography).
 */
import { Platform } from "react-native";

export const CHAT_MOBILE = {
  /** Conversation thread background */
  wallpaper: "#FFFFFF",
  composerBar: "#FFFFFF",
  composerInput: "#FFFFFF",
  headerBg: "#FFFFFF",
  headerBorder: "#EFF2F5",
  bubbleMaxWidthPct: "78%",
  avatarSize: 36,
  bubbleFontSize: 12,
  bubbleLineHeight: 17,
  bubblePadH: 10,
  bubblePadV: 8,
  bubbleRadius: 12,
  metaFontSize: 9,
  headerTitleSize: 13,
  headerSubtitleSize: 10,
  listRowPad: 8,
  listAvatar: 42,
  /** Horizontal people strip at top of Slack-style inbox */
  peopleStripAvatar: 46,
  listTitleSize: 13,
  listPreviewSize: 11,
  listTimeSize: 9,
  composerMinHeight: 36,
  composerMaxHeight: 96,
  composerFontSize: 13,
  composerLineHeight: 18,
  iconBtn: 32,
  sendBtnHeight: 34,
  sendBtnMinWidth: 64,
  plusBtn: 32,
  /** Centered system / payment / location event cards in the thread. */
  eventCardRadius: 10,
  eventCardPadH: 12,
  eventCardPadV: 10,
  eventTitleSize: 13,
  eventTitleLine: 18,
  eventMetaSize: 11,
  eventMetaLine: 15,
  eventSubSize: 10,
  eventAmountSize: 13,
  eventTimeSize: 10,
  eventAvatar: 36,
  eventCardGap: 6,
} as const;

/** Slack-style inbox + thread on phones and mobile web (any viewport under desktop breakpoint). */
export function isChatMobileLayout(isDesktop: boolean): boolean {
  return !isDesktop;
}

/** Native iOS/Android only — excludes mobile web. */
export function isChatNativeMobile(isDesktop: boolean): boolean {
  return Platform.OS !== "web" && !isDesktop;
}

/**
 * Fallback space above a fixed mobile-web composer before onLayout measures the dock.
 * Slack variant: input row + formatting bar + borders + optional typing strip.
 */
export function mobileWebComposerReservePx(): number {
  return (
    CHAT_MOBILE.composerMinHeight +
    CHAT_MOBILE.sendBtnHeight +
    36 + // formatting toolbar
    24 // padding / hairlines
  );
}
