/**
 * Document image preview inside chat document_share cards.
 * Preserves original aspect ratio (contain) — never stretches to a fixed box.
 */
import { LoadingIndicator } from "@pulse/ui/components/LoadingIndicator";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  loadImageNaturalSize,
  resolveFitImageLayout,
} from "@pulse/domain/features/chat/utils/fitImageInViewport.util";
import { chatPreviewFetchForDisplay } from "@pulse/domain/features/chat/utils/chatPreviewTransform.util";
import {
  peekChatImageThumbnailUrl,
  resolveChatImageThumbnail,
} from "@pulse/domain/features/chat/utils/resolveChatDocumentUrl.util";

const DEFAULT_MAX_W = 300;
const DEFAULT_MAX_H = 200;

export interface ChatDocumentThreadPreviewProps {
  storagePath: string;
  maxWidth?: number;
  maxHeight?: number;
}

export function ChatDocumentThreadPreview({
  storagePath,
  maxWidth = DEFAULT_MAX_W,
  maxHeight = DEFAULT_MAX_H,
}: ChatDocumentThreadPreviewProps) {
  const fetch = chatPreviewFetchForDisplay(maxWidth, maxHeight, "contain");

  const [uri, setUri] = useState<string | null>(() =>
    storagePath
      ? peekChatImageThumbnailUrl(
          storagePath,
          fetch.width,
          fetch.height,
          fetch.quality,
          "contain",
        )
      : null,
  );
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(
    () =>
      !storagePath ||
      !peekChatImageThumbnailUrl(
        storagePath,
        fetch.width,
        fetch.height,
        fetch.quality,
        "contain",
      ),
  );

  useEffect(() => {
    let cancelled = false;
    setLayout(null);

    void (async () => {
      const url = await resolveChatImageThumbnail(
        storagePath,
        fetch.width,
        fetch.height,
        fetch.quality,
        "contain",
      );
      if (cancelled) return;
      if (!url) {
        setUri(null);
        setLoading(false);
        return;
      }

      let natural = await loadImageNaturalSize(url);
      if (cancelled) return;

      if (!natural) {
        natural = { width: maxWidth, height: Math.round(maxWidth * 0.75) };
      }

      setUri(url);
      setLayout(
        resolveFitImageLayout(natural, maxWidth, maxHeight, {
          horizontal: 0,
          top: 0,
          bottom: 0,
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [storagePath, maxWidth, maxHeight, fetch.width, fetch.height, fetch.quality]);

  if (loading) {
    return (
      <View style={[styles.placeholder, { maxWidth, maxHeight }]}>
        <LoadingIndicator size="small" color="#94a3b8" />
      </View>
    );
  }

  if (!uri || !layout) return null;

  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri }}
        style={{
          width: layout.width,
          height: layout.height,
          borderRadius: 8,
        }}
        contentFit="contain"
        transition={120}
        accessibilityLabel="Document preview"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  placeholder: {
    alignSelf: "center",
    width: "100%",
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
});
