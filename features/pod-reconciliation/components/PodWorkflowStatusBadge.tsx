import Theme from "@/constants/Theme";
import { StyleSheet, Text, View } from "react-native";
import {
  derivePodDisplayStatus,
  podDisplayStatusLabel,
  podStatusToneColor,
  type PodDisplayStatus,
} from "../utils/podWorkflowDisplay.util";
import type { PodReconciliationTripView } from "../services/podReconciliationService";

function softFill(color: string): string {
  // Prefer Theme muted fills when tones match known statuses.
  if (color === "#b00020" || color === Theme.negative) return Theme.negativeMuted;
  if (color === "#b45309" || color === Theme.warning) return Theme.warningMuted;
  if (color === "#059669" || color === Theme.positive) return Theme.positiveMuted;
  return Theme.brandBlueSoft;
}

export function PodWorkflowStatusBadge({
  trip,
  status: statusOverride,
  compact = false,
}: {
  trip?: PodReconciliationTripView;
  status?: PodDisplayStatus;
  compact?: boolean;
}) {
  const status =
    statusOverride ??
    (trip ? derivePodDisplayStatus(trip) : ("pod_pending" as PodDisplayStatus));
  const color = podStatusToneColor(status);
  const label = podDisplayStatusLabel(status);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: softFill(color) },
      ]}
      accessibilityLabel={`POD status ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text
        style={[styles.text, compact && styles.textCompact, { color }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 168,
    alignSelf: "flex-start",
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 160,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  textCompact: {
    fontSize: 10,
  },
});
