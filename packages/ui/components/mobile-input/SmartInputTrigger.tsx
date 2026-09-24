/**
 * Tappable field that opens the fullscreen entry flow.
 *
 * Two variants:
 *   'row'   — label left, value right with chevron (for form rows / list sections)
 *   'field' — stacked label above value (for boxed form fields)
 *   'hero'  — centered large amount (payment / settlement screens)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Theme from '@pulse/core/constants/Theme';

export type TriggerVariant = 'row' | 'field' | 'hero';
export type TriggerValueColor = 'default' | 'positive' | 'negative';
export type TriggerDensity = 'default' | 'compact';

export interface SmartInputTriggerProps {
  label: string;
  displayValue?: string;
  placeholder?: string;
  onPress: () => void;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  valueColor?: TriggerValueColor;
  variant?: TriggerVariant;
  density?: TriggerDensity;
  required?: boolean;
  errorMessage?: string;
  /** Tint for hero variant currency prefix (defaults to Theme.primary). */
  heroAccentColor?: string;
}

export function SmartInputTrigger({
  label,
  displayValue,
  placeholder = 'Tap to enter',
  onPress,
  disabled = false,
  prefix,
  suffix,
  valueColor = 'default',
  variant = 'row',
  density = 'default',
  required = false,
  errorMessage,
  heroAccentColor = Theme.primary,
}: SmartInputTriggerProps) {
  const compact = density === 'compact';
  const hasValue = !!displayValue;

  const valueStyle =
    valueColor === 'positive'
      ? styles.valuePositive
      : valueColor === 'negative'
      ? styles.valueNegative
      : undefined;

  if (variant === 'hero') {
    const heroPrefix = prefix !== undefined ? prefix : '₹';
    return (
      <View style={styles.heroWrapper}>
        <TouchableOpacity
          style={[
            styles.heroPressable,
            compact && styles.heroPressableCompact,
            disabled && styles.rowDisabled,
          ]}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${displayValue || placeholder}`}
          accessibilityState={{ disabled }}
        >
          <View style={styles.heroAmountRow}>
            <Text
              style={[
                styles.heroPrefix,
                compact && styles.heroPrefixCompact,
                { color: heroAccentColor },
              ]}
            >
              {heroPrefix}
            </Text>
            <Text
              style={[
                styles.heroValue,
                compact && styles.heroValueCompact,
                !hasValue && styles.heroPlaceholder,
                valueStyle,
              ]}
            >
              {hasValue ? displayValue : placeholder || '0'}
            </Text>
            {suffix && hasValue ? (
              <Text style={[styles.heroSuffix, compact && styles.heroSuffixCompact, valueStyle]}>
                {suffix}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.heroTapHint, compact && styles.heroTapHintCompact]}>
            Tap to edit amount
          </Text>
        </TouchableOpacity>
        {errorMessage ? (
          <Text style={styles.heroErrorText}>{errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  if (variant === 'field') {
    return (
      <TouchableOpacity
        style={[
          styles.field,
          compact && styles.fieldCompact,
          disabled && styles.fieldDisabled,
          !!errorMessage && styles.fieldHasError,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue || placeholder}`}
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <View style={styles.fieldValueRow}>
          {prefix && hasValue ? (
            <Text style={[styles.fieldPrefix, compact && styles.fieldPrefixCompact, valueStyle]}>
              {prefix}
            </Text>
          ) : null}
          <Text
            style={[
              styles.fieldValue,
              compact && styles.fieldValueCompact,
              !hasValue && styles.fieldPlaceholder,
              !hasValue && compact && styles.fieldPlaceholderCompact,
              valueStyle,
            ]}
          >
            {hasValue ? displayValue : placeholder}
          </Text>
          {suffix && hasValue ? (
            <Text style={[styles.fieldSuffix, compact && styles.fieldSuffixCompact, valueStyle]}>
              {suffix}
            </Text>
          ) : null}
        </View>
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  // 'row' variant (default)
  return (
    <View style={styles.rowWrapper}>
      <TouchableOpacity
        style={[
          styles.row,
          compact && styles.rowCompact,
          disabled && styles.rowDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue || placeholder}`}
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.rowLabel, compact && styles.rowLabelCompact]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <View style={styles.rowRight}>
          {prefix && hasValue ? (
            <Text style={[styles.rowPrefix, compact && styles.rowPrefixCompact, valueStyle]}>
              {prefix}
            </Text>
          ) : null}
          <Text
            style={[
              styles.rowValue,
              compact && styles.rowValueCompact,
              !hasValue && styles.rowPlaceholder,
              !hasValue && compact && styles.rowPlaceholderCompact,
              valueStyle,
            ]}
          >
            {hasValue ? displayValue : placeholder}
          </Text>
          {suffix && hasValue ? (
            <Text style={[styles.rowSuffix, compact && styles.rowSuffixCompact, valueStyle]}>
              {suffix}
            </Text>
          ) : null}
          <Text style={[styles.chevron, compact && styles.chevronCompact]}>›</Text>
        </View>
      </TouchableOpacity>
      {errorMessage ? (
        <Text style={styles.rowErrorText}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Row variant ──
  rowWrapper: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Theme.screenBackground,
    minHeight: 58,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '400',
    color: Theme.textPrimary,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    maxWidth: '60%',
  },
  rowPrefix: {
    fontSize: 16,
    fontWeight: '400',
    color: Theme.textBody,
  },
  rowValue: {
    fontSize: 19,
    fontWeight: '600',
    color: Theme.textBody,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  rowPlaceholder: {
    color: Theme.textMuted,
    fontWeight: '400',
    fontSize: 17,
  },
  rowSuffix: {
    fontSize: 15,
    color: Theme.textSecondary,
    marginLeft: 2,
  },
  chevron: {
    fontSize: 22,
    color: Theme.textMuted,
    marginLeft: 4,
    lineHeight: 24,
  },
  rowErrorText: {
    fontSize: 12,
    color: Theme.negative,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },

  // ── Field variant ──
  field: {
    backgroundColor: Theme.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    minHeight: 64,
    justifyContent: 'center',
  },
  fieldDisabled: {
    opacity: 0.45,
  },
  fieldHasError: {
    borderColor: Theme.negative,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  fieldPrefix: {
    fontSize: 17,
    fontWeight: '400',
    color: Theme.textBody,
  },
  fieldValue: {
    fontSize: 21,
    fontWeight: '600',
    color: Theme.textBody,
    fontVariant: ['tabular-nums'],
  },
  fieldPlaceholder: {
    color: Theme.textMuted,
    fontWeight: '400',
    fontSize: 19,
  },
  fieldSuffix: {
    fontSize: 15,
    color: Theme.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: Theme.negative,
    marginTop: 4,
  },

  // ── Shared ──
  required: {
    color: Theme.negative,
    fontWeight: '600',
  },
  valuePositive: {
    color: Theme.positive,
  },
  valueNegative: {
    color: Theme.negative,
  },

  rowCompact: {
    paddingHorizontal: 0,
    paddingVertical: 6,
    minHeight: 34,
    backgroundColor: 'transparent',
  },
  rowLabelCompact: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowPrefixCompact: {
    fontSize: 11,
  },
  rowValueCompact: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowPlaceholderCompact: {
    fontSize: 10,
    fontWeight: '500',
  },
  rowSuffixCompact: {
    fontSize: 10,
  },
  chevronCompact: {
    fontSize: 14,
    lineHeight: 16,
    marginLeft: 2,
  },

  fieldCompact: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 40,
    backgroundColor: Theme.whiteMuted,
  },
  fieldLabelCompact: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldPrefixCompact: {
    fontSize: 11,
  },
  fieldValueCompact: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldPlaceholderCompact: {
    fontSize: 10,
    fontWeight: '500',
  },
  fieldSuffixCompact: {
    fontSize: 10,
  },

  heroWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  heroPressable: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 200,
  },
  heroPressableCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 0,
    width: '100%',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  heroPrefix: {
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 40,
    marginRight: 2,
  },
  heroPrefixCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: '300',
    color: Theme.textPrimaryDark,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
  },
  heroValueCompact: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  heroPlaceholder: {
    color: Theme.textMuted,
    fontWeight: '300',
  },
  heroSuffix: {
    fontSize: 22,
    fontWeight: '400',
    color: Theme.textSecondary,
    marginLeft: 2,
  },
  heroSuffixCompact: {
    fontSize: 16,
  },
  heroTapHint: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    color: Theme.textMuted,
    letterSpacing: 0.2,
  },
  heroTapHintCompact: {
    marginTop: 3,
    fontSize: 9,
  },
  heroErrorText: {
    marginTop: 6,
    fontSize: 11,
    color: Theme.negative,
    textAlign: 'center',
  },
});
