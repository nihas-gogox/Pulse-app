import Theme from "@/constants/Theme";
import {
  COMPLIANCE_STAGE_TONE,
  type ComplianceVerifiedOutcomeFilter as OutcomeFilter,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const OPTIONS: { id: OutcomeFilter; label: string; dot: string | null }[] = [
  { id: "all", label: "All", dot: null },
  { id: "verified", label: "Verified", dot: COMPLIANCE_STAGE_TONE.compliance_verified.fg },
  { id: "rejected", label: "Rejected", dot: COMPLIANCE_STAGE_TONE.pending_for_docs.fg },
];

/** Segmented All / Verified / Rejected control above the Verified-stage trip cards. */
export function ComplianceVerifiedOutcomeFilter({
  value,
  counts,
  onChange,
}: {
  value: OutcomeFilter;
  counts: Record<OutcomeFilter, number>;
  onChange: (next: OutcomeFilter) => void;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.track} accessibilityRole="tablist">
        {OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}, ${counts[option.id]} trips`}
              hitSlop={{ top: 8, bottom: 8 }}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && !active && styles.segmentPressed,
              ]}
            >
              {option.dot ? (
                <View style={[styles.dot, { backgroundColor: option.dot }]} />
              ) : null}
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              <Text style={[styles.count, active && styles.countActive]}>
                {counts[option.id]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    gap: 3,
    borderRadius: 10,
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  segmentActive: {
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    shadowColor: Theme.textPrimaryDark,
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentPressed: { opacity: 0.7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
  labelActive: { color: Theme.textPrimaryDark, fontWeight: "700" },
  count: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
  },
  countActive: { color: Theme.textPrimaryDark },
});
