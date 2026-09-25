import { stripChatPreviewEmojiPrefix } from "@pulse/domain/features/chat/utils/chatAvatar.util";
import {
  collectTrailingImagePreviews,
  type ConversationImagePreview,
} from "@pulse/domain/features/chat/utils/conversationImagePreview.util";
import {
  resolveTrailingMediaBurstSummary,
  tripChatMessageSenderKey,
} from "@pulse/domain/features/chat/utils/chatMediaBurst.util";
import type { TripConversation } from "@pulse/domain/features/chat/types/chat.types";

export type DriverInboxListPreview = {
  preview: string | null;
  previewKind: "default" | "image";
  previewImagePreviews?: ConversationImagePreview[];
};

/** Inbox row preview for driver trip threads (image strip + caption). */
export function resolveDriverInboxListPreview(
  conv: TripConversation,
): DriverInboxListPreview {
  const fallbackText = stripChatPreviewEmojiPrefix(
    conv.last_message_preview?.trim() ?? "",
  );

  const burstSummary = resolveTrailingMediaBurstSummary(conv.messages, {
    senderKey: tripChatMessageSenderKey,
  });
  if (burstSummary && burstSummary.imagePreviews.length > 0) {
    return {
      preview:
        burstSummary.summaryText ||
        fallbackText ||
        "Photo",
      previewKind: "image",
      previewImagePreviews: burstSummary.imagePreviews,
    };
  }

  const imagePreviews = collectTrailingImagePreviews(conv.messages);
  if (imagePreviews.length > 0) {
    return {
      preview: fallbackText || "Photo",
      previewKind: "image",
      previewImagePreviews: imagePreviews,
    };
  }

  return {
    preview: fallbackText || null,
    previewKind: "default",
  };
}
