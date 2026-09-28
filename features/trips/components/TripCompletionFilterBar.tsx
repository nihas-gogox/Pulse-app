import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import type { TripCompletionListFilter } from "@/features/trips/services/tripDocumentLrPod.service";
import { Pressable, StyleSheet, Text, View } from "react-native";

const OPTIONS: { id: TripCompletionListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "not_completed", label: "Not completed" },
];

export function TripCompletionFilterBar({
  value,
  onChange,
  completedCount,
  notCompletedCount,
}: {
  value: TripCompletionListFilter;
  onChange: (next: TripCompletionListFilter) => void;
  completedCount: number;
  notCompletedCount: number;
}) {
  const countFor = (id: TripCompletionListFilter): number | null => {
    if (id === "completed") return completedCount;
    if (id === "not_completed") return notCompletedCount;
    return completedCount + notCompletedCount;
  };

  return (
    <View
      style={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel="Filter by trip completion"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        const count = countFor(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, active && styles.chipOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              count != null ? `${opt.label}, ${count}` : opt.label
            }
            hitSlop={Layout.touchTargetHitSlop}
          >
            <Text style={[styles.chipText, active && styles.chipTextOn]}>
              {opt.label}
            </Text>
            {count != null ? (
              <View style={[styles.countPill, active && styles.countPillOn]}>
                <Text style={[styles.count, active && styles.countOn]}>
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipOn: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textRouteCard,
  },
  chipTextOn: {
    color: Theme.cardWhite,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Theme.surfaceGray,
    alignItems: "center",
  },
  countPillOn: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  count: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
  },
  countOn: {
    color: Theme.cardWhite,
  },
});
