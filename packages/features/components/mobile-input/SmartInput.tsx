/**
 * SmartInput — universal financial / numeric input component.
 *
 * Renders a tappable trigger field. On tap, opens a focused full-screen
 * entry experience (mobile) or a right-side drawer (desktop) with a
 * custom decimal keypad — no native keyboard for financial inputs.
 *
 * Usage:
 *   <SmartInput
 *     type="currency"
 *     label="Supplier Cost"
 *     context="Trip: BLR → CHN · XYZ Transport"
 *     value={supplierCost}
 *     onChange={(raw, numeric) => setSupplierCost(numeric)}
 *   />
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { FullscreenNumericEntry } from './FullscreenNumericEntry';
import type { NumericEntryPartyPreview } from '../../../../components/mobile-input/NumericEntryPartyBanner';
import { SmartInputTrigger } from '@pulse/ui/components/mobile-input/SmartInputTrigger';
import { formatDisplayValue, toRawString, parseRawToNumber } from '@pulse/ui/components/mobile-input/keypad';
import { validateEntry, resolveValidationRule } from '@pulse/ui/components/mobile-input/validation';
import { triggerFeedback } from '@pulse/ui/components/mobile-input/feedback';
import type { TriggerDensity, TriggerVariant, TriggerValueColor } from '@pulse/ui/components/mobile-input/SmartInputTrigger';
import type { ValidationRule, SmartInputType } from '../../../../components/mobile-input/types';
import Theme from '@pulse/core/constants/Theme';

export type { SmartInputType };

const webStyles = StyleSheet.create({
  // field variant
  fieldWrap: { width: '100%' },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Theme.textSecondary,
    marginBottom: 6,
  },
  fieldLabelCompact: { fontSize: 9, marginBottom: 4 },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: 12,
    backgroundColor: Theme.surfaceForm,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Theme.textPrimary,
    paddingVertical: 10,
    minWidth: 0,
  },
  fieldInputCompact: { fontSize: 14, paddingVertical: 8 },
  // row variant
  rowWrap: { width: '100%' },
  rowLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: Theme.textPrimary,
    marginBottom: 6,
  },
  rowLabelCompact: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: 10,
    backgroundColor: Theme.surfaceForm,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Theme.textPrimary,
    paddingVertical: 10,
    minWidth: 0,
  },
  // hero variant
  heroWrap: { width: '100%', alignItems: 'center' },
  heroShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: 16,
    backgroundColor: Theme.surfaceForm,
    paddingHorizontal: 20,
    minHeight: 64,
    width: '100%',
  },
  heroPrefix: {
    fontSize: 28,
    fontWeight: '400',
    color: Theme.textPrimary,
    marginRight: 4,
  },
  heroSuffix: {
    fontSize: 20,
    fontWeight: '400',
    color: Theme.textSecondary,
    marginLeft: 4,
  },
  heroInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '300',
    color: Theme.textPrimaryDark,
    paddingVertical: 12,
    textAlign: 'center',
    letterSpacing: -1,
    minWidth: 0,
  },
  // shared
  prefix: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.textPrimary,
    marginRight: 6,
  },
  suffix: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.textSecondary,
    marginLeft: 4,
  },
  shellError: { borderColor: Theme.destructive, backgroundColor: '#fef2f2' },
  disabled: { opacity: 0.45 },
  req: { color: Theme.destructive },
  error: { marginTop: 5, fontSize: 11, fontWeight: '600', color: Theme.destructive },
});

export interface SmartInputProps {
  /** Semantic type — drives prefix/suffix defaults and display formatting */
  type?: SmartInputType;

  /** Current value as number or raw string. Pass undefined / 0 for empty state. */
  value?: number | string;

  /**
   * Called when the user applies a new value.
   * @param raw     The raw digit string ("45000", "7.5")
   * @param numeric Parsed JS number (safe for display math, use raw for DB writes)
   */
  onChange: (raw: string, numeric: number) => void;

  /** Displayed in the trigger row and as the entry header */
  label: string;

  /** Secondary line in the entry header, e.g. "Trip: BLR → CHN" */
  context?: string;

  /** Party row (avatar + name) on the numeric entry screen. */
  partyPreview?: NumericEntryPartyPreview;

  /** Trigger layout variant */
  variant?: TriggerVariant;

  /** Compact trigger typography for dense operational forms */
  density?: TriggerDensity;

  /** Hero trigger accent (currency prefix colour). */
  heroAccentColor?: string;

  /** Placeholder shown when value is empty */
  placeholder?: string;

  /** Override auto prefix (currency → '₹'). Pass '' to suppress. */
  prefix?: string;

  /** Override auto suffix (percentage → '%'). Pass '' to suppress. */
  suffix?: string;

  /** Button label inside the entry screen */
  submitLabel?: string;

  /** Allow decimal input (default true) */
  allowDecimal?: boolean;

  /** Maximum decimal places (0-2). Overrides allowDecimal=false. */
  maxDecimalPlaces?: 0 | 1 | 2;

  /** Validation rules applied before onChange fires. */
  validation?: ValidationRule;

  /**
   * Semantic coloring for the trigger value.
   * 'auto' → green for positive, red for negative.
   */
  valueColor?: TriggerValueColor | 'auto';

  disabled?: boolean;
  required?: boolean;
  /** External error from form validation (shown below the trigger). */
  errorMessage?: string;
  /**
   * Controlled open state for the fullscreen entry sheet.
   * Use with `onOpenChange` to chain steps (e.g. Spend → Liters).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SmartInput({
  type = 'currency',
  value,
  onChange,
  label,
  context,
  partyPreview,
  variant = 'row',
  density = 'default',
  placeholder,
  prefix,
  suffix,
  submitLabel = 'Apply',
  allowDecimal = true,
  maxDecimalPlaces,
  validation,
  valueColor = 'default',
  heroAccentColor,
  disabled = false,
  required = false,
  errorMessage,
  open: openProp,
  onOpenChange,
}: SmartInputProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [entryError, setEntryError] = useState<string | undefined>();
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Strip commas and normalise to raw digit string for the entry screen
  const rawInitial = useMemo(() => toRawString(value), [value]);

  // Formatted value for the trigger chip
  const displayValue = useMemo(() => {
    const raw = toRawString(value);
    if (!raw) return '';
    return formatDisplayValue(raw, type);
  }, [value, type]);

  // Resolve 'auto' colour
  const resolvedColor = useMemo((): TriggerValueColor => {
    if (valueColor !== 'auto') return valueColor;
    const n = parseRawToNumber(toRawString(value));
    return n > 0 ? 'positive' : n < 0 ? 'negative' : 'default';
  }, [valueColor, value]);

  // Merge required + allowDecimal + explicit validation into a single rule
  const resolvedRule = useMemo(
    () => resolveValidationRule({ required, allowDecimal, maxDecimalPlaces, validation }),
    [required, allowDecimal, maxDecimalPlaces, validation],
  );

  // Effective prefix/suffix shown in the trigger
  const triggerPrefix = prefix !== undefined ? prefix : type === 'currency' ? '₹ ' : undefined;
  const triggerSuffix = suffix !== undefined ? suffix : type === 'percentage' ? '%' : undefined;

  const handleSubmit = useCallback(
    (raw: string) => {
      const numeric = parseRawToNumber(raw);
      const result = validateEntry(raw, resolvedRule, numeric);
      if (!result.valid) {
        setEntryError(result.errorMessage);
        triggerFeedback('error');
        return;
      }
      setEntryError(undefined);
      onChange(raw, numeric);
      setOpen(false);
    },
    [onChange, resolvedRule, setOpen],
  );

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setEntryError(undefined);
    setOpen(true);
  }, [disabled, setOpen]);

  const { width: winW } = useWindowDimensions();
  // Web desktop (≥600 px): skip numpad — allow native keyboard input.
  // Mobile web (narrow) and all native Expo builds keep the numpad.
  if (Platform.OS === 'web' && winW >= 600) {
    const webOutline = { outlineStyle: 'none' } as unknown as TextStyle;
    const showPrefix = triggerPrefix && (variant === 'field' || variant === 'hero');
    const showSuffix = triggerSuffix && (variant === 'field' || variant === 'hero');
    const handleWebChange = (text: string) => {
      const raw = text.replace(/[^\d.]/g, '');
      const numeric = parseRawToNumber(raw);
      onChange(raw, numeric);
    };
    const webValue = toRawString(value);

    if (variant === 'row') {
      return (
        <View style={webStyles.rowWrap}>
          <Text style={[webStyles.rowLabel, density === 'compact' && webStyles.rowLabelCompact]}>
            {label}{required ? <Text style={webStyles.req}> *</Text> : null}
          </Text>
          <View style={[webStyles.rowShell, !!errorMessage && webStyles.shellError]}>
            {triggerPrefix ? <Text style={webStyles.prefix}>{triggerPrefix}</Text> : null}
            <TextInput
              value={webValue}
              onChangeText={handleWebChange}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={placeholder ?? '0'}
              placeholderTextColor={Theme.placeholder}
              style={[webStyles.rowInput, webOutline]}
              editable={!disabled}
              accessibilityLabel={label}
            />
            {triggerSuffix ? <Text style={webStyles.suffix}>{triggerSuffix}</Text> : null}
          </View>
          {errorMessage ? <Text style={webStyles.error}>{errorMessage}</Text> : null}
        </View>
      );
    }

    if (variant === 'hero') {
      return (
        <View style={webStyles.heroWrap}>
          <View style={[webStyles.heroShell, !!errorMessage && webStyles.shellError]}>
            {showPrefix ? <Text style={webStyles.heroPrefix}>{triggerPrefix}</Text> : null}
            <TextInput
              value={webValue}
              onChangeText={handleWebChange}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={placeholder ?? '0'}
              placeholderTextColor={Theme.placeholder}
              style={[webStyles.heroInput, webOutline]}
              editable={!disabled}
              accessibilityLabel={label}
            />
            {showSuffix ? <Text style={webStyles.heroSuffix}>{triggerSuffix}</Text> : null}
          </View>
          {errorMessage ? <Text style={webStyles.error}>{errorMessage}</Text> : null}
        </View>
      );
    }

    // 'field' variant (default for web)
    return (
      <View style={webStyles.fieldWrap}>
        <Text style={[webStyles.fieldLabel, density === 'compact' && webStyles.fieldLabelCompact]}>
          {label}{required ? <Text style={webStyles.req}> *</Text> : null}
        </Text>
        <View style={[webStyles.fieldShell, !!errorMessage && webStyles.shellError, disabled && webStyles.disabled]}>
          {showPrefix ? <Text style={webStyles.prefix}>{triggerPrefix}</Text> : null}
          <TextInput
            value={webValue}
            onChangeText={handleWebChange}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={placeholder ?? '0'}
            placeholderTextColor={Theme.placeholder}
            style={[webStyles.fieldInput, density === 'compact' && webStyles.fieldInputCompact, webOutline]}
            editable={!disabled}
            accessibilityLabel={label}
          />
          {showSuffix ? <Text style={webStyles.suffix}>{triggerSuffix}</Text> : null}
        </View>
        {errorMessage ? <Text style={webStyles.error}>{errorMessage}</Text> : null}
      </View>
    );
  }

  return (
    <>
      <SmartInputTrigger
        label={label}
        displayValue={displayValue}
        placeholder={placeholder}
        onPress={handleOpen}
        disabled={disabled}
        prefix={triggerPrefix}
        suffix={triggerSuffix}
        valueColor={resolvedColor}
        variant={variant}
        density={density}
        heroAccentColor={heroAccentColor}
        required={required}
        errorMessage={errorMessage}
      />

      <FullscreenNumericEntry
        visible={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        initialValue={rawInitial}
        label={label}
        contextLine={context}
        partyPreview={partyPreview}
        type={type}
        prefix={prefix}
        suffix={suffix}
        placeholder={placeholder}
        allowDecimal={allowDecimal}
        maxDecimalPlaces={maxDecimalPlaces}
        submitLabel={submitLabel}
        validationError={entryError}
      />
    </>
  );
}
