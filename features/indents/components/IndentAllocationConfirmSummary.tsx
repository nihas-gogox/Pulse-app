/**
 * Final-step / OTP allocation review — rows with optional Edit → prior wizard step.
 */
import { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Theme from "@/constants/Theme";

export type IndentAllocationConfirmRow = {
  id: string;
  label: string;
  value: string;
  /** Jump back to this wizard step (omitted on OTP / read-only). */
  onEdit?: () => void;
};

const SPEC_ROW_IDS = new Set(["vehicleType", "product", "weight"]);

export type IndentAllocationConfirmSummaryProps = {
  title?: string;
  hint?: string | null;
  rows: readonly IndentAllocationConfirmRow[];
  /** Phone: one line per fact so the confirm step fits above the footer. */
  compact?: boolean;
};

export const IndentAllocationConfirmSummary = memo(
  function IndentAllocationConfirmSummary({
    title = "Confirm allocation",
    hint = "Tap Edit to change a detail before converting.",
    rows,
    compact = false,
  }: IndentAllocationConfirmSummaryProps) {
    if (!rows.length) return null;

    const detailRows = compact
      ? rows.filter((row) => !SPEC_ROW_IDS.has(row.id))
      : rows;
    const specLine = compact
      ? rows
          .filter((row) => SPEC_ROW_IDS.has(row.id) && row.value.trim())
          .map((row) => row.value.trim())
          .join("  ·  ")
      : "";

    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {title ? (
          <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        ) : null}
        {hint && !compact ? <Text style={styles.hint}>{hint}</Text> : null}
        <View style={styles.card}>
          {detailRows.map((row, index) => (
            <View
              key={row.id}
              style={[
                compact ? styles.rowCompact : styles.row,
                index < detailRows.length - 1 || specLine
                  ? styles.rowBorder
                  : null,
              ]}
            >
              {compact ? (
                <Text style={styles.labelCompact} numberOfLines={1}>
                  {row.label}
                </Text>
              ) : null}
              <View style={compact ? styles.rowValueCompact : styles.rowText}>
                {compact ? null : (
                  <Text style={styles.label}>{row.label}</Text>
                )}
                <Text
                  style={compact ? styles.valueCompact : styles.value}
                  numberOfLines={compact ? 1 : 2}
                >
                  {row.value}
                </Text>
              </View>
              {row.onEdit ? (
                <Pressable
                  onPress={row.onEdit}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${row.label}`}
                  style={styles.editHit}
                >
                  <Text style={styles.edit}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {specLine ? (
            <Text style={styles.specLine} numberOfLines={2}>
              {specLine}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 10,
  },
  wrapCompact: {
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
  },
  titleCompact: {
    fontSize: 13,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textMuted,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 58,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
  },
  editHit: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  edit: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.primary,
  },
  rowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 6,
  },
  labelCompact: {
    width: 92,
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  rowValueCompact: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  valueCompact: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
    textAlign: "right",
  },
  specLine: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textRouteCard,
    letterSpacing: -0.1,
  },
});
