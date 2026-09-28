/**
 * Manifest Pulse step icon — completed / current / pending visual states.
 * Presentation only; phase is supplied by the parent.
 */
import { Check } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import Theme from "@/constants/Theme";

export function ManifestPulseStepIcon({
  phase,
}: {
  phase: "completed" | "current" | "pending";
}) {
  if (phase === "completed") {
    return (
      <View style={manifestPulseStepStyles.completed}>
        <Check size={13} color={Theme.cardWhite} strokeWidth={3.2} />
      </View>
    );
  }
  if (phase === "current") {
    return (
      <View style={manifestPulseStepStyles.currentOuter}>
        <View style={manifestPulseStepStyles.currentInner}>
          <View style={manifestPulseStepStyles.currentDot} />
        </View>
      </View>
    );
  }
  return (
    <View style={manifestPulseStepStyles.pendingOuter}>
      <View style={manifestPulseStepStyles.pendingInner} />
    </View>
  );
}

const manifestPulseStepStyles = StyleSheet.create({
  completed: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.driverEmerald,
    borderWidth: 3,
    borderColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  currentOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.cardWhite,
    borderWidth: 3,
    borderColor: "rgba(43,49,113,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  currentInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.analyticsHeroBg,
    alignItems: "center",
    justifyContent: "center",
  },
  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Theme.cardWhite,
  },
  pendingOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.cardWhite,
    borderWidth: 2,
    borderColor: Theme.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.borderMedium,
  },
});
