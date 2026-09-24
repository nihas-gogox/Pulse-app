import type {
  ConversationPartyType,
  MessageType,
  TripMessageRow,
} from "../types/chat.types";
import { chatListThumbFetch } from "./chatPreviewTransform.util";
import { resolveDocumentShareDisplay } from "./documentShareDisplay.util";
import { peekChatImageThumbnailUrl } from "./resolveChatDocumentUrl.util";

export type ConversationImagePreview = {
  url: string;
  storagePath?: string | null;
};

const LIST_THUMB_DISPLAY_W = 156;

function trimStoragePath(message: TripMessageRow): string {
  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : null;
  const fromMeta =
    typeof metadata?.storage_path === "string" ? metadata.storage_path.trim() : "";
  if (fromMeta && !/^https?:\/\//i.test(fromMeta)) return fromMeta;
  const raw = (message.content ?? "").trim();
  if (raw && !/^https?:\/\//i.test(raw)) return raw;
  return fromMeta || "";
}

function previewUrlFromStoragePath(storagePath: string): string | null {
  const fetch = chatListThumbFetch(LIST_THUMB_DISPLAY_W);
  return peekChatImageThumbnailUrl(
    storagePath,
    fetch.width,
    fetch.height,
    fetch.quality,
    "cover",
  );
}

/** Single image thumbnail from a trip chat message (image or image document). */
export function imagePreviewFromTripMessage(
  message: TripMessageRow | null | undefined,
): ConversationImagePreview | null {
  if (!message) return null;

  if (message.message_type === "image") {
    const storagePath = trimStoragePath(message);
    if (storagePath) {
      const url = previewUrlFromStoragePath(storagePath);
      return { url: url ?? "", storagePath };
    }
    const raw = (message.content ?? "").trim();
    if (/^https?:\/\//i.test(raw)) {
      return { url: raw, storagePath: null };
    }
    return null;
  }

  if (
    message.message_type === "document_share" ||
    message.message_type === "document_upload"
  ) {
    const doc = resolveDocumentShareDisplay(message);
    if (!doc?.isImage || !doc.storagePath) return null;
    const url = previewUrlFromStoragePath(doc.storagePath);
    return { url: url ?? "", storagePath: doc.storagePath };
  }

  return null;
}

/** Consecutive trailing image messages (newest last) for inbox thumbnail strip. */
export function collectTrailingImagePreviews(
  messages: TripMessageRow[],
  options?: {
    partyType?: ConversationPartyType;
    manualDriverOnly?: boolean;
    isMessageVisible?: (
      messageType: MessageType,
      partyType: ConversationPartyType,
    ) => boolean;
    isManualDriverMessage?: (message: TripMessageRow) => boolean;
    max?: number;
  },
): ConversationImagePreview[] {
  const max = options?.max ?? 12;
  const previews: ConversationImagePreview[] = [];

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    if (
      message.message_type === "feedback_request" ||
      message.message_type === "feedback"
    ) {
      continue;
    }
    if (options?.partyType && options.isMessageVisible) {
      if (!options.isMessageVisible(message.message_type, options.partyType)) {
        continue;
      }
    }
    if (options?.manualDriverOnly && options.isManualDriverMessage) {
      if (!options.isManualDriverMessage(message)) {
        if (previews.length === 0) break;
        break;
      }
    }

    const item = imagePreviewFromTripMessage(message);
    if (!item) break;
    previews.unshift(item);
    if (previews.length >= max) break;
  }

  return previews;
}
