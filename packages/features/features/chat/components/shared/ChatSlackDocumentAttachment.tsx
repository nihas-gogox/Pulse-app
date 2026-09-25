import { LoadingIndicator } from "@pulse/ui/components/LoadingIndicator";
import { CHAT_ACCENT, CHAT_INCOMING_BUBBLE } from "@pulse/domain/features/chat/chatTheme";
import { ChatDocumentThreadPreview } from "../ChatDocumentThreadPreview";
import {
  documentExtensionAccent,
  type DocumentShareDisplay,
} from "@pulse/domain/features/chat/utils/documentShareDisplay.util";
import { FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react-native";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

function FileTypeIcon({
  extension,
  isImage,
  size,
  color,
}: {
  extension: string;
  isImage: boolean;
  size: number;
  color: string;
}) {
  const e = extension.toLowerCase();
  if (isImage || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(e)) {
    return <ImageIcon size={size} color={color} strokeWidth={2.2} />;
  }
  if (["xls", "xlsx", "csv"].includes(e)) {
    return <FileSpreadsheet size={size} color={color} strokeWidth={2.2} />;
  }
  return <FileText size={size} color={color} strokeWidth={2.2} />;
}

export function ChatSlackDocumentAttachmentCompact({
  display,
  style,
}: {
  display: Pick<DocumentShareDisplay, "documentName" | "extension" | "isImage">;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = documentExtensionAccent(display.extension);
  return (
    <View style={[compactStyles.row, style]}>
      <View style={[compactStyles.iconTile, { backgroundColor: `${accent}18` }]}>
        <FileTypeIcon
          extension={display.extension}
          isImage={display.isImage}
          size={12}
          color={accent}
        />
      </View>
      <Text style={compactStyles.name} numberOfLines={1}>
        {display.documentName}
      </Text>
    </View>
  );
}

export function ChatSlackDocumentAttachment({
  display,
  isOwn,
  onPress,
  opening = false,
  style,
}: {
  display: DocumentShareDisplay;
  isOwn: boolean;
  onPress: () => void;
  opening?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = documentExtensionAccent(display.extension);
  const subtitle = [
    display.extension || null,
    display.documentType !== "Document" ? display.documentType : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      disabled={opening}
      style={({ pressed }) => [
        threadStyles.card,
        isOwn ? threadStyles.cardOwn : threadStyles.cardOther,
        pressed && threadStyles.cardPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${display.documentName}`}
    >
      <View style={threadStyles.headerRow}>
        <View
          style={[
            threadStyles.iconTile,
            {
              backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : `${accent}14`,
            },
          ]}
        >
          <FileTypeIcon
            extension={display.extension}
            isImage={display.isImage}
            size={18}
            color={isOwn ? "#FFFFFF" : accent}
          />
        </View>
        <View style={threadStyles.textCol}>
          <Text
            style={[threadStyles.fileName, isOwn && threadStyles.fileNameOwn]}
            numberOfLines={2}
          >
            {display.documentName}
          </Text>
          {subtitle ? (
            <Text
              style={[threadStyles.fileMeta, isOwn && threadStyles.fileMetaOwn]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {opening ? (
          <LoadingIndicator
            size="small"
            color={isOwn ? "#fff" : CHAT_ACCENT}
          />
        ) : (
          <Text style={[threadStyles.openHint, isOwn && threadStyles.openHintOwn]}>
            Open
          </Text>
        )}
      </View>

      {display.isImage && display.storagePath ? (
        <View style={threadStyles.thumbWrap}>
          <ChatDocumentThreadPreview storagePath={display.storagePath} />
        </View>
      ) : null}
    </Pressable>
  );
}

const compactStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
    minWidth: 0,
  },
  iconTile: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    color: "#616061",
  },
});

const threadStyles = StyleSheet.create({
  card: {
    minWidth: 220,
    maxWidth: 340,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  cardOwn: {
    alignSelf: "flex-end",
    backgroundColor: CHAT_ACCENT,
    borderColor: "rgba(255,255,255,0.22)",
  },
  cardOther: {
    alignSelf: "flex-start",
    backgroundColor: CHAT_INCOMING_BUBBLE,
    borderColor: "#E5E7EB",
  },
  cardPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: "#1D1C1D",
  },
  fileNameOwn: {
    color: "#FFFFFF",
  },
  fileMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: "#616061",
    textTransform: "capitalize",
  },
  fileMetaOwn: {
    color: "rgba(255,255,255,0.78)",
  },
  openHint: {
    fontSize: 10,
    fontWeight: "700",
    color: CHAT_ACCENT,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  openHintOwn: {
    color: "rgba(255,255,255,0.9)",
  },
  thumbWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingTop: 2,
  },
});
