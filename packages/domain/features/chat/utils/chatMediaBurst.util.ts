import type { TripMessageRow } from "../types/chat.types";
import {
  imagePreviewFromTripMessage,
  type ConversationImagePreview,
} from "./conversationImagePreview.util";

/** Same window as Slack-style text grouping for trip threads. */
export const CHAT_MEDIA_BURST_GAP_MS = 15 * 60 * 1000;

export type ChatMediaBurstImageItem = {
  message: TripMessageRow;
  preview: ConversationImagePreview;
};

export type ChatMediaBurstLeader = {
  messages: TripMessageRow[];
  imageItems: ChatMediaBurstImageItem[];
  captionText: string;
};

export function isChatMediaBurstEligible(message: TripMessageRow): boolean {
  const type = message.message_type ?? "text";
  if (type === "text") return Boolean((message.content ?? "").trim());
  if (type === "image") return true;
  if (type === "document_share" || type === "document_upload") {
    return imagePreviewFromTripMessage(message) != null;
  }
  return false;
}

function burstCaptionFromMessages(messages: readonly TripMessageRow[]): string {
  return messages
    .filter((m) => (m.message_type ?? "text") === "text")
    .map((m) => (m.content ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function burstImageItemsFromMessages(
  messages: readonly TripMessageRow[],
): ChatMediaBurstImageItem[] {
  const items: ChatMediaBurstImageItem[] = [];
  for (const message of messages) {
    const preview = imagePreviewFromTripMessage(message);
    if (preview) items.push({ message, preview });
  }
  return items;
}

/**
 * Collapses consecutive text + image messages from the same sender (≤ gap) into one
 * thread row: horizontal image strip with optional caption text below.
 */
export function buildChatMediaBurstIndex<T extends TripMessageRow>(
  messages: readonly T[],
  options: {
    senderKey: (message: T) => string;
    maxGapMs?: number;
  },
): {
  leaders: Map<string, ChatMediaBurstLeader>;
  skipIds: Set<string>;
} {
  const maxGap = options.maxGapMs ?? CHAT_MEDIA_BURST_GAP_MS;
  const leaders = new Map<string, ChatMediaBurstLeader>();
  const skipIds = new Set<string>();

  let run: T[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const imageItems = burstImageItemsFromMessages(run);
    if (imageItems.length === 0) {
      run = [];
      return;
    }

    const leader = run[0];
    leaders.set(leader.id, {
      messages: [...run],
      imageItems,
      captionText: burstCaptionFromMessages(run),
    });
    for (let i = 1; i < run.length; i += 1) {
      skipIds.add(run[i].id);
    }
    run = [];
  };

  for (const message of messages) {
    if (!isChatMediaBurstEligible(message)) {
      flush();
      continue;
    }

    const ts = Date.parse(message.created_at);
    const prev = run[run.length - 1];
    const prevTs = prev ? Date.parse(prev.created_at) : NaN;
    const canContinue =
      run.length > 0 &&
      options.senderKey(message) === options.senderKey(prev) &&
      Number.isFinite(ts) &&
      Number.isFinite(prevTs) &&
      ts - prevTs <= maxGap;

    if (canContinue) {
      run.push(message);
    } else {
      flush();
      run = [message];
    }
  }

  flush();
  return { leaders, skipIds };
}

export type InboxMediaBurstSummary = {
  imagePreviews: ConversationImagePreview[];
  /** Multi-line caption from text messages in the burst (newest lines last). */
  summaryText: string;
  burstMessageCount: number;
};

/**
 * Slack-style inbox preview: trailing 15-min media burst from the same sender —
 * image strip + combined text summary (not only the single latest line).
 */
export function resolveTrailingMediaBurstSummary(
  messages: readonly TripMessageRow[],
  options: {
    senderKey: (message: TripMessageRow) => string;
    filterMessage?: (message: TripMessageRow) => boolean;
    maxGapMs?: number;
    maxImages?: number;
    maxSummaryLines?: number;
  },
): InboxMediaBurstSummary | null {
  const filtered = options.filterMessage
    ? messages.filter(options.filterMessage)
    : [...messages];
  if (filtered.length === 0) return null;

  const { leaders, skipIds } = buildChatMediaBurstIndex(filtered, {
    senderKey: options.senderKey,
    maxGapMs: options.maxGapMs,
  });

  const last = filtered[filtered.length - 1];
  let leaderEntry: ChatMediaBurstLeader | null = leaders.get(last.id) ?? null;

  if (!leaderEntry && skipIds.has(last.id)) {
    for (const burst of leaders.values()) {
      if (burst.messages.some((m) => m.id === last.id)) {
        leaderEntry = burst;
        break;
      }
    }
  }

  if (!leaderEntry || leaderEntry.imageItems.length === 0) return null;

  const maxImages = options.maxImages ?? 12;
  const imagePreviews = leaderEntry.imageItems
    .slice(-maxImages)
    .map((item) => item.preview);

  const maxLines = options.maxSummaryLines ?? 3;
  const summaryText = leaderEntry.captionText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-maxLines)
    .join("\n");

  return {
    imagePreviews,
    summaryText,
    burstMessageCount: leaderEntry.messages.length,
  };
}

export function tripChatMessageSenderKey(message: TripMessageRow): string {
  return `${message.sender_role ?? ""}:${message.sender_user_id ?? ""}:${message.sender_name ?? ""}`;
}
