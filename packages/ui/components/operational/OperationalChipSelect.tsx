import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Theme from "@pulse/core/constants/Theme";
import { colors } from "@/design-system/colors";
import { radius } from "@/design-system/radius";
import { space } from "@/design-system/spacing";

export type OperationalChipOption<T extends string> = {
  value: T;
  label: string;
};

export interface OperationalChipSelectProps<T extends string> {
  label: string;
  hint?: string;
  options: ReadonlyArray<OperationalChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** When true, chips use a denser 3-column wrap grid (default on mobile-friendly forms). */
  compact?: boolean;
  /** Tighter label + chip typography for operational entry forms. */
  density?: "default" | "compact";
}

function OperationalChipSelectInner<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  compact = true,
  density = "default",
}: OperationalChipSelectProps<T>) {
  const dense = density === "compact";
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, dense && styles.labelCompact]}>{label}</Text>
      {hint ? <Text style={[styles.hint, dense && styles.hintCompact]}>{hint}</Text> : null}
      <View style={[styles.grid, compact && styles.gridCompact, dense && styles.gridDense]}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                compact && styles.chipCompact,
                dense && styles.chipDense,
                active && styles.chipActive,
                pressed && !active && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[
                  styles.chipText,
                  dense && styles.chipTextDense,
                  active && styles.chipTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const OperationalChipSelect = memo(
  OperationalChipSelectInner,
) as typeof OperationalChipSelectInner;

const styles = StyleSheet.create({
  wrap: {
    gap: space[1],
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  labelCompact: {
    fontSize: 8,
    letterSpacing: 0.6,
    lineHeight: 10,
  },
  hint: {
    fontSize: 9,
    fontWeight: "500",
    color: colors.textMuted,
    lineHeight: 12,
    marginBottom: 2,
  },
  hintCompact: {
    fontSize: 8,
    lineHeight: 11,
    marginBottom: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  gridCompact: {
    gap: 6,
  },
  gridDense: {
    gap: 4,
  },
  chip: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 76,
    maxWidth: "48%",
    minHeight: 34,
    paddingHorizontal: space[2],
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCompact: {
    flexBasis: "31%",
    minWidth: 72,
    minHeight: 32,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  chipDense: {
    flexBasis: "31%",
    minWidth: 68,
    minHeight: 26,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 7,
  },
  chipActive: {
    // Soft brand wash + ink rim/label — never pastel text on pastel fill.
    backgroundColor: Theme.brandBlueSoft,
    borderColor: Theme.buttonPrimaryBorder,
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  chipTextDense: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  chipTextActive: {
    color: Theme.buttonPrimaryText,
    fontWeight: "800",
  },
});
