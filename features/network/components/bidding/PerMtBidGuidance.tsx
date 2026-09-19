/**
 * Per-MT bid highlighter + expected-trip strip.
 * Makes a ₹/MT target unmissable and shows vehicle × rate as an estimate
 * when indent weight is not yet known.
 */
import Theme from "@/constants/Theme";
import {
  formatTonnesLabel,
  perMtEstimateChipTonnes,
  type PerMtExpectedTrip,
} from "@/features/network/utils/bidding/perMtBidPresentation.util";
import { formatINR } from "@/lib/format";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type PerMtBidGuidanceProps = {
  targetUnitRateInr: number | null;
  typedUnitRateInr: number;
  expected: PerMtExpectedTrip | null;
  showEstimateChips: boolean;
  estimateTonnes: number | null;
  vehicleType?: string | null;
  onEstimateTonnesChange: (tonnes: number) => void;
  /** `banner` sits above the keypad; `estimate` sits under the amount. */
  parts?: "all" | "banner" | "estimate";
};

function sourceCaption(
  source: PerMtExpectedTrip["source"],
  vehicleType?: string | null,
): string {
  if (source === "indent_weight") return "Load weight";
  if (source === "vehicle_type") {
    const label = (vehicleType ?? "").trim();
    return label ? `From ${label}` : "From vehicle";
  }
  return "Estimate";
}

export const PerMtBidGuidance = memo(function PerMtBidGuidance({
  targetUnitRateInr,
  typedUnitRateInr,
  expected,
  showEstimateChips,
  estimateTonnes,
  vehicleType,
  onEstimateTonnesChange,
  parts = "all",
}: PerMtBidGuidanceProps) {
  const chips = showEstimateChips ? perMtEstimateChipTonnes(vehicleType) : [];
  const rateForMath =
    typedUnitRateInr > 0 ? typedUnitRateInr : (targetUnitRateInr ?? 0);
  const isEstimate = expected != null && expected.source !== "indent_weight";
  const showBanner = parts === "all" || parts === "banner";
  const showEstimate = parts === "all" || parts === "estimate";

  return (
    <View style={styles.root}>
      {showBanner ? (
        <>
          <View style={styles.highlighter}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PER MT</Text>
            </View>
            <Text style={styles.highlighterCopy}>
              You are bidding a rate per tonne, not a trip total
            </Text>
          </View>

          {targetUnitRateInr != null && targetUnitRateInr > 0 ? (
            <Text style={styles.targetLine}>
              Target {formatINR(targetUnitRateInr)}/MT
            </Text>
          ) : null}
        </>
      ) : null}

      {showEstimate && typedUnitRateInr > 0 ? (
        <Text style={styles.liveLine}>
          You&apos;re bidding {formatINR(typedUnitRateInr)}/MT
        </Text>
      ) : null}

      {showEstimate && expected != null && rateForMath > 0 ? (
        <View
          style={[styles.expectedCard, isEstimate && styles.expectedCardEstimate]}
        >
          <Text style={styles.expectedKicker}>
            {isEstimate ? "≈ Expected trip" : "Expected trip"}
            {" · "}
            {sourceCaption(expected.source, vehicleType)}
          </Text>
          <Text style={styles.expectedAmount}>
            {isEstimate ? "≈ " : ""}
            {formatINR(expected.amountInr)}
          </Text>
          <Text style={styles.expectedMath}>
            {formatINR(rateForMath)}/MT × {formatTonnesLabel(expected.tonnes)}
          </Text>
        </View>
      ) : showEstimate && showEstimateChips ? (
        <Text style={styles.pickHint}>Pick a tonnage to see trip value</Text>
      ) : null}

      {showEstimate && chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((tonnes) => {
            const selected = estimateTonnes === tonnes;
            return (
              <Pressable
                key={tonnes}
                onPress={() => onEstimateTonnesChange(tonnes)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Estimate at ${formatTonnesLabel(tonnes)}`}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {formatTonnesLabel(tonnes)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: 8,
    alignItems: "center",
  },
  highlighter: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Theme.warningMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.accentGoldBorder,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Theme.accentGold,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: Theme.textPrimary,
  },
  highlighterCopy: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    color: Theme.textPrimaryDark,
  },
  targetLine: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
  },
  liveLine: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
  expectedCard: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Theme.driverEmeraldMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.driverEmeraldBorderSoft,
    gap: 2,
  },
  expectedCardEstimate: {
    backgroundColor: Theme.surfaceGray,
    borderColor: Theme.borderMedium,
  },
  expectedKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  expectedAmount: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: Theme.textPrimaryDark,
  },
  expectedMath: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
  pickHint: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  chip: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderMedium,
  },
  chipSelected: {
    backgroundColor: Theme.accentGoldMuted,
    borderColor: Theme.accentGold,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textSecondary,
  },
  chipTextSelected: {
    color: Theme.textPrimaryDark,
  },
});
