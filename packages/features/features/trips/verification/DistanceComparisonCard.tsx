import Theme from "@pulse/core/constants/Theme";
import { StyleSheet, Text, View } from "react-native";

function km(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KM`;
}

export function DistanceComparisonCard({
  odometerDistanceKm,
  gpsDistanceKm,
  discrepancyKm,
}: {
  odometerDistanceKm: number | null | undefined;
  gpsDistanceKm: number | null | undefined;
  discrepancyKm: number | null | undefined;
}) {
  const hasWarn = discrepancyKm != null && discrepancyKm >= 10;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Odometer Distance</Text>
        <Text style={styles.value}>{km(odometerDistanceKm)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>GPS Distance</Text>
        <Text style={styles.value}>{km(gpsDistanceKm)}</Text>
      </View>
      <View style={[styles.row, styles.lastRow]}>
        <Text style={styles.label}>Discrepancy</Text>
        <Text style={[styles.value, hasWarn && styles.warnValue]}>{km(discrepancyKm)}</Text>
      </View>
      {hasWarn ? (
        <Text style={styles.warnText}>
          Distance differs from GPS by {km(discrepancyKm)}. Review when convenient.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.surface,
    borderColor: Theme.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastRow: {
    paddingBottom: 2,
  },
  label: {
    fontSize: 12,
    color: Theme.textSecondary,
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    color: Theme.text,
    fontWeight: "700",
  },
  warnValue: {
    color: "#b45309",
  },
  warnText: {
    marginTop: 2,
    color: "#b45309",
    fontSize: 12,
    lineHeight: 17,
  },
});
