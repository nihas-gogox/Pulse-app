import { ChatImage, resolveChatImageStorageKey } from "../ChatImage";
import { useChatMediaGallery } from "./ChatMediaGalleryLightbox";
import type { ChatMediaBurstImageItem } from "@pulse/domain/features/chat/utils/chatMediaBurst.util";
import { chatGallerySlideFromBurstItem } from "@pulse/domain/features/chat/utils/chatMediaGallery.util";
import { isDirectChatImageHttpUrl } from "@pulse/domain/features/chat/utils/storageRenderImageUrl";
import { ZoomIn } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

const THUMB_GAP = 8;
const VISIBLE_COLS = 2.35;
const MIN_THUMB_W = 128;
const MAX_THUMB_W = 220;
const THUMB_H = 148;

function ThreadThumb({
  item,
  width,
  onPress,
}: {
  item: ChatMediaBurstImageItem;
  width: number;
  onPress: () => void;
}) {
  const radius = Math.max(8, Math.round(width * 0.08));
  const storagePath =
    item.preview.storagePath ??
    ((typeof item.message.metadata === "object" &&
    item.message.metadata &&
    typeof (item.message.metadata as Record<string, unknown>).storage_path === "string"
      ? String((item.message.metadata as Record<string, unknown>).storage_path)
      : "") ||
      (() => {
        const content = String(item.message.content ?? "").trim();
        return content && !/^https?:\/\//i.test(content) ? content : "";
      })());
  const directUrl =
    item.preview.url && isDirectChatImageHttpUrl(item.preview.url) && !resolveChatImageStorageKey(storagePath)
      ? item.preview.url
      : isDirectChatImageHttpUrl(storagePath)
        ? storagePath
        : null;
  const imageSource = resolveChatImageStorageKey(storagePath) || directUrl || storagePath || "";
  const preferredUrl =
    isDirectChatImageHttpUrl(item.preview.url) ? item.preview.url : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.thumbPressable,
        { width, height: THUMB_H, borderRadius: radius, opacity: pressed ? 0.92 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open image preview"
    >
      {imageSource ? (
        <View
          style={[
            styles.thumbShell,
            { width, height: THUMB_H, borderRadius: radius, overflow: "hidden" },
          ]}
        >
          <ChatImage
            storagePath={imageSource}
            preferredUrl={preferredUrl}
            message={item.message}
            thumbnail
            displayWidth={width}
            displayHeight={THUMB_H}
            contentFit="contain"
            style={{ width, height: THUMB_H, borderRadius: radius }}
          />
        </View>
      ) : null}
      <View style={styles.zoomBadge}>
        <ZoomIn size={12} color="#fff" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

export function ChatThreadMediaStrip({
  items,
  bodyWidth,
}: {
  items: ChatMediaBurstImageItem[];
  bodyWidth?: number;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const gallery = useChatMediaGallery();

  const thumbWidth = useMemo(() => {
    const fallback = Math.min(screenWidth * 0.62, MAX_THUMB_W);
    const base = bodyWidth && bodyWidth > 0 ? bodyWidth : measuredWidth || fallback;
    const raw = Math.floor((base - THUMB_GAP * (VISIBLE_COLS - 1)) / VISIBLE_COLS);
    return Math.max(MIN_THUMB_W, Math.min(MAX_THUMB_W, raw));
  }, [bodyWidth, measuredWidth, screenWidth]);

  const slides = useMemo(
    () => items.map((item, index) => chatGallerySlideFromBurstItem(item, index)),
    [items],
  );

  const openAt = (index: number) => {
    gallery.open(slides, index);
  };

  if (items.length === 0) return null;

  const thumbs = items.map((item, index) => (
    <ThreadThumb
      key={item.message.id || item.preview.storagePath || item.preview.url || String(index)}
      item={item}
      width={thumbWidth}
      onPress={() => openAt(index)}
    />
  ));

  const onLayout = (w: number) => {
    if (w > 0 && Math.abs(w - measuredWidth) > 1) setMeasuredWidth(w);
  };

  const content =
    items.length === 1 ? (
      <View style={styles.singleRow} onLayout={(e) => onLayout(e.nativeEvent.layout.width)}>
        {thumbs}
      </View>
    ) : (
      <View onLayout={(e) => onLayout(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { gap: THUMB_GAP }]}
        >
          {thumbs}
        </ScrollView>
      </View>
    );

  return (
    <>
      {content}
      {gallery.node}
    </>
  );
}

const styles = StyleSheet.create({
  singleRow: {
    marginTop: 4,
  },
  scroll: {
    marginTop: 4,
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  thumbPressable: {
    position: "relative",
    overflow: "hidden",
  },
  thumbShell: {
    backgroundColor: "#E5E7EB",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
  },
  thumbImage: {
    backgroundColor: "#E5E7EB",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1D5DB",
  },
  zoomBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
