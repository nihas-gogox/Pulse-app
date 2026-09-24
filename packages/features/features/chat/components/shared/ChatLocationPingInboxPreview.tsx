import { MapPin } from "lucide-react-native";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Theme } from "@pulse/core/constants/Theme";

/** Inbox / sidebar preview for driver location pings — route pin + human copy. */
export function ChatLocationPingInboxPreview({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.iconTile}>
        <MapPin size={12} color="#059669" strokeWidth={2.3} />
      </View>
      <Text style={styles.copy} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(5, 150, 105, 0.22)",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
});
