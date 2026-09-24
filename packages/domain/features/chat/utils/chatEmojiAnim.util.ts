/** Shared quick emoji sets for composer panels + reaction toolbars. */
export const CHAT_QUICK_PANEL_EMOJIS = [
  "👍",
  "✅",
  "🚛",
  "📍",
  "🕒",
  "🤝",
  "😊",
  "⚡",
  "🔥",
  "❤️",
] as const;

export const CHAT_QUICK_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "✅",
  "🚛",
] as const;

export const CHAT_DESKTOP_COMPOSER_EMOJIS = [
  "👍",
  "🤝",
  "🚛",
  "📍",
  "✅",
  "📦",
  "⚠️",
  "🕒",
  "😊",
  "🙌",
  "📞",
  "💯",
  "🔥",
  "❤️",
] as const;

export type ChatEmojiMotion = "pulse" | "flicker" | "bounce" | "wiggle" | "heartbeat";

const FLICKER = new Set(["🔥", "⚡", "💯"]);
const HEARTBEAT = new Set(["❤️", "😊", "🤩", "🙌", "😂"]);
const BOUNCE = new Set(["🚛", "📦", "📍", "🚚", "📞"]);
const WIGGLE = new Set(["⚠️", "🤝", "✅", "👍"]);

export function resolveChatEmojiMotion(emoji: string): ChatEmojiMotion {
  if (FLICKER.has(emoji)) return "flicker";
  if (HEARTBEAT.has(emoji)) return "heartbeat";
  if (BOUNCE.has(emoji)) return "bounce";
  if (WIGGLE.has(emoji)) return "wiggle";
  return "pulse";
}

export type ChatEmojiSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "jumbo"
  | "inbox";

export const CHAT_EMOJI_FONT_SIZES: Record<ChatEmojiSize, number> = {
  xs: 16,
  sm: 22,
  md: 28,
  lg: 38,
  xl: 46,
  "2xl": 54,
  jumbo: 68,
  /** ~2× inbox list preview text (11px) — subtle, not jumbo-thread scale. */
  inbox: 22,
};

const EMOJI_GLYPH_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;

/** True when the message is only emoji glyphs (optional spaces between). */
export function parseEmojiOnlyGlyphs(content: string): string[] | null {
  const trimmed = (content ?? "").trim();
  if (!trimmed || /\*\*|_|`/.test(trimmed)) return null;

  const glyphs = trimmed.match(EMOJI_GLYPH_RE);
  if (!glyphs?.length) return null;

  const remainder = trimmed.replace(EMOJI_GLYPH_RE, "").replace(/\s+/g, "");
  if (remainder.length > 0) return null;

  return glyphs;
}

/** Slack-style jumbo scale — fewer emojis render larger. */
export function resolveJumboEmojiSize(count: number): ChatEmojiSize {
  if (count <= 1) return "jumbo";
  if (count <= 3) return "2xl";
  if (count <= 6) return "xl";
  return "lg";
}

/** Inbox row preview — ~2× preview text, capped so rows stay compact. */
export function resolveInboxEmojiPreviewSize(count: number): ChatEmojiSize {
  if (count <= 1) return "inbox";
  if (count <= 3) return "sm";
  return "xs";
}

export function chatEmojiLoopDurationMs(motion: ChatEmojiMotion): number {
  switch (motion) {
    case "flicker":
      return 520;
    case "heartbeat":
      return 760;
    case "bounce":
      return 980;
    case "wiggle":
      return 880;
    default:
      return 1200;
  }
}
