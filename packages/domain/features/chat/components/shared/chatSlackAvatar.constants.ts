/**
 * Shared Slack-style chat avatar sizes — mobile, mobile web, and desktop web.
 */
export const SLACK_CHAT_AVATAR = {
  /** Inbox list header profile chip */
  listHeader: 40,
  /** Thread header / profile chip in chrome */
  header: 36,
  /** Horizontal partners / on-trip people strip */
  people: 46,
  /** Inbox list row + desktop sidebar conversation row */
  list: 42,
  /** Message thread row avatar */
  thread: 36,
} as const;

/** Desktop sidebar uses the same visual scale as mobile inbox rows. */
export const SLACK_DESKTOP_CHAT_AVATAR = {
  sidebar: SLACK_CHAT_AVATAR.list,
  thread: SLACK_CHAT_AVATAR.header,
  message: SLACK_CHAT_AVATAR.thread,
} as const;
