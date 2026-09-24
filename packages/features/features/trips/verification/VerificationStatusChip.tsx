import Theme from "@pulse/core/constants/Theme";
import type { OdometerVerificationState } from "@pulse/domain/features/trips/verification/types";
import { StyleSheet, Text, View } from "react-native";

const LABELS: Record<OdometerVerificationState, string> = {
  none: "No Verification",
  partial: "Partial Verification",
  driver_verified: "Driver Verified",
  business_verified: "Business Verified",
  gps_verified: "GPS Verified",
};

export function VerificationStatusChip({
  state,
  compact = false,
}: {
  state: OdometerVerificationState;
  compact?: boolean;
}) {
  const tone = resolveChipTone(state);
  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <Text style={[styles.text, compact && styles.textCompact, { color: tone.text }]}>
        {LABELS[state]}
      </Text>
    </View>
  );
}

function resolveChipTone(state: OdometerVerificationState): {
  bg: string;
  border: string;
  text: string;
} {
  if (state === "gps_verified") {
    return { bg: "#eef2ff", border: "#c7d2fe", text: "#4D3636" };
  }
  if (state === "business_verified") {
    return { bg: "#ecfdf3", border: "#bbf7d0", text: "#15803d" };
  }
  if (state === "driver_verified") {
    return { bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1" };
  }
  if (state === "partial") {
    return { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" };
  }
  return {
    bg: Theme.whiteMuted,
    border: Theme.border,
    text: Theme.textSecondary,
  };
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
  textCompact: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
