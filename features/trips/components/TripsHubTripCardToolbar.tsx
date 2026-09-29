/**
 * Desktop grid footer — e-way bill expiry in place of the sales / due chips.
 */
import Theme from "@/constants/Theme";
import { ewayExpiryTone } from "@/features/trips/services/ewayBillFields.util";
import { Platform, StyleSheet, Text, View } from "react-native";

export type TripsHubTripCardToolbarProps = {
  ewayExpiryLabel?: string | null;
  /** Post-loading trips keep E-LR on the card through later stages. */
  showElr?: boolean;
  dense?: boolean;
};

export function TripsHubTripCardToolbar({
  ewayExpiryLabel,
  showElr = false,
}: TripsHubTripCardToolbarProps) {
  const label = (ewayExpiryLabel ?? "").trim();
  if (!label && !showElr) return null;
  const tone = label ? ewayExpiryTone(label) : "ok";

  return (
    <View style={styles.wrap} accessibilityLabel={showElr ? "E-LR" : label}>
      {showElr ? (
        <View style={[styles.tag, styles.tagElr]}>
          <Text style={[styles.tagText, styles.tagTextElr]} numberOfLines={1}>
            E-LR
          </Text>
        </View>
      ) : null}
      {label ? (
        <View
          style={[
            styles.tag,
            tone === "ok" && styles.tagOk,
            tone === "expired" && styles.tagExpired,
          ]}
        >
          <Text
            style={[
              styles.tagText,
              tone === "ok" && styles.tagTextOk,
              tone === "expired" && styles.tagTextExpired,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "center",
    gap: 4,
    backgroundColor: "transparent",
    maxWidth: "100%",
    marginTop: -2,
  },
  tag: {
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 5,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.warning,
    maxWidth: "100%",
  },
  tagOk: {
    borderColor: Theme.positive,
  },
  tagExpired: {
    borderColor: Theme.negative,
  },
  tagElr: {
    borderColor: Theme.primary,
  },
  tagText: {
    color: Theme.warning,
    fontSize: 8,
    fontWeight: "500",
    lineHeight: 10,
    includeFontPadding: false,
    ...Platform.select({
      android: { textAlignVertical: "center" as const },
      default: {},
    }),
  },
  tagTextOk: {
    color: Theme.positive,
  },
  tagTextExpired: {
    color: Theme.negative,
  },
  tagTextElr: {
    color: Theme.primary,
  },
});
