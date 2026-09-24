import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { TripMessageRow } from "@pulse/domain/features/chat/types/chat.types";
import { resolveChatDocumentStorageUrl } from "@pulse/domain/features/chat/utils/resolveChatDocumentUrl.util";
import { resolveDocumentShareDisplay } from "@pulse/domain/features/chat/utils/documentShareDisplay.util";
import { ChatSlackDocumentAttachment } from "./shared/ChatSlackDocumentAttachment";
import { useDocumentPreview } from "./DocumentPreviewModal";

interface DocumentShareCardProps {
  message: TripMessageRow;
  isOwn: boolean;
}

export function DocumentShareCard({ message, isOwn }: DocumentShareCardProps) {
  const display = useMemo(() => resolveDocumentShareDisplay(message), [message]);
  const [linkUri, setLinkUri] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const { open: openPreview, node: previewNode } = useDocumentPreview();

  if (!display) return null;

  let displayTime = message.created_at;
  try {
    displayTime = new Date(message.created_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    // keep raw
  }

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url =
        linkUri ?? (await resolveChatDocumentStorageUrl(display.storagePath));
      if (url) {
        if (!linkUri) setLinkUri(url);
        await openPreview(url, display.mimeType, display.documentName);
      } else {
        Alert.alert(
          "Preview unavailable",
          "We could not open this file. Ask your admin to apply the latest database migrations for trip-document storage access, or open the file from the trip detail screen.",
          [{ text: "OK" }],
        );
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={[s.wrap, isOwn ? s.wrapOwn : s.wrapOther]}>
      <ChatSlackDocumentAttachment
        display={display}
        isOwn={isOwn}
        onPress={handleOpen}
        opening={opening}
      />
      <Text style={[s.time, isOwn && s.timeOwn]}>
        {displayTime}
        {!isOwn && message.sender_name
          ? ` · ${message.sender_name}`
          : ""}
      </Text>
      {previewNode}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  wrapOwn: {
    alignItems: "flex-end",
  },
  wrapOther: {
    alignItems: "flex-start",
  },
  time: {
    fontSize: 10,
    color: "#8B8B8B",
    fontWeight: "500",
    paddingHorizontal: 2,
  },
  timeOwn: {
    textAlign: "right",
  },
});
