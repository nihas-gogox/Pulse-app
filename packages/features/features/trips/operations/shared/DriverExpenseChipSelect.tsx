import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronDown } from "lucide-react-native";

import Theme from "@pulse/core/constants/Theme";
import Typography from "@pulse/core/constants/Typography";

import {
  resolveDriverChipVisual,
  type DriverChipVisual,
} from "@pulse/domain/features/trips/operations/shared/driverExpenseChipVisuals.util";

export type DriverExpenseChipOption<T extends string> = {
  value: T;
  label: string;
  visual?: DriverChipVisual;
};

export type DriverExpenseChipGroup =
  | "other_category"
  | "driver_expense_category"
  | "payment_mode"
  | "payment_owner"
  | "fuel_type"
  | "toll_entry"
  | "generic";

type Props<T extends string> = {
  label: string;
  hint?: string;
  options: ReadonlyArray<DriverExpenseChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Equal-width tile columns (2 for categories, 3 for payment). */
  columns?: 2 | 3;
  /** Auto-resolve Lucide icons + tints from value. */
  visualGroup?: DriverExpenseChipGroup;
  /**
   * After a pick, collapse to a single selected summary (Add Trip pattern).
   * Tap summary / Change to expand and pick again. Default on.
   */
  collapseAfterSelect?: boolean;
  /** Locked selection — summary only, no Change. */
  disabled?: boolean;
};

const GRID_GAP = 6;

/**
 * Equal-width icon tiles + minimize-after-select summary.
 * Shared by driver and business trip expense entry.
 */
export function DriverExpenseChipSelect<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  columns = 3,
  visualGroup = "generic",
  collapseAfterSelect = true,
  disabled = false,
}: Props<T>) {
  // When collapse is on, start minimized so a pre-selected value (and remounts
  // after category nav) don't leave the full grid open.
  const [expanded, setExpanded] = useState(!collapseAfterSelect);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!collapseAfterSelect) setExpanded(true);
  }, [collapseAfterSelect]);

  const prevValueRef = useRef(value);
  useEffect(() => {
    if (!collapseAfterSelect) return;
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setExpanded(false);
    }
  }, [value, collapseAfterSelect]);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value],
  );

  const resolveVisual = useCallback(
    (option: DriverExpenseChipOption<T> | null): DriverChipVisual | null => {
      if (!option) return null;
      if (option.visual) return option.visual;
      if (visualGroup === "generic") return null;
      return resolveDriverChipVisual(option.value, visualGroup);
    },
    [visualGroup],
  );

  const handleSelect = useCallback(
    (next: T) => {
      if (disabled) return;
      // Collapse immediately so selection always minimizes in one tap,
      // even when parent navigation remounts shortly after.
      if (collapseAfterSelect) setExpanded(false);
      if (next !== value) onChange(next);
    },
    [collapseAfterSelect, disabled, onChange, value],
  );

  const onGridLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setGridWidth((prev) => (prev === next ? prev : next));
  }, []);

  const tileWidth =
    gridWidth > 0
      ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns)
      : undefined;

  const selectedVisual = resolveVisual(selected);
  const SelectedIcon = selectedVisual?.Icon;
  const showCollapsed =
    collapseAfterSelect && selected != null && (disabled || !expanded);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {showCollapsed ? (
        <Pressable
          onPress={() => {
            if (!disabled) setExpanded(true);
          }}
          style={({ pressed }) => [
            styles.summaryRow,
            pressed && !disabled && styles.summaryPressed,
            disabled && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? ""}. Change`}
          disabled={disabled}
        >
          {SelectedIcon ? (
            <SelectedIcon size={15} color={Theme.textMuted} strokeWidth={2} />
          ) : null}
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {selected?.label ?? "—"}
          </Text>
          {!disabled ? (
            <ChevronDown size={14} color={Theme.textMuted} strokeWidth={2.2} />
          ) : null}
        </Pressable>
      ) : (
        <View style={styles.grid} onLayout={onGridLayout}>
          {options.map((option) => {
            const active = option.value === value;
            const visual = resolveVisual(option);
            const Icon = visual?.Icon;

            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={({ pressed }) => [
                  styles.tile,
                  tileWidth != null
                    ? { width: tileWidth }
                    : columns === 2
                      ? styles.tileFallbackHalf
                      : styles.tileFallback,
                  columns === 2 ? styles.tileTall : null,
                  active && styles.tileActive,
                  pressed && !active && styles.tilePressed,
                  disabled && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
              >
                {Icon ? (
                  <Icon
                    size={14}
                    color={active ? Theme.driverEmeraldDark : Theme.textMuted}
                    strokeWidth={2.1}
                  />
                ) : null}
                <Text
                  style={[styles.tileText, active && styles.tileTextActive]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 5,
  },
  label: {
    ...Typography.headerTitle,
    fontSize: 9,
    letterSpacing: 0.55,
    color: Theme.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  hint: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textSecondary,
    lineHeight: 15,
    marginTop: -2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.28)",
    backgroundColor: Theme.surfaceGray,
  },
  summaryPressed: {
    backgroundColor: "rgba(241,245,249,1)",
  },
  summaryTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  tile: {
    minHeight: 52,
    paddingHorizontal: 4,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.26)",
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  /** Before first layout measure — keep roughly equal widths. */
  tileFallback: {
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "32%",
  },
  tileFallbackHalf: {
    flexGrow: 1,
    flexBasis: "47%",
    maxWidth: "48.5%",
  },
  tileTall: {
    minHeight: 56,
  },
  tileActive: {
    backgroundColor: Theme.driverEmeraldMuted,
    borderColor: Theme.driverEmerald,
    borderWidth: 1.5,
  },
  tilePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  tileText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "center",
    lineHeight: 12,
    letterSpacing: -0.1,
    width: "100%",
  },
  tileTextActive: {
    color: Theme.driverEmeraldDark,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
});
