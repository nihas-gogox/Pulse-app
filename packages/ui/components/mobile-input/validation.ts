/**
 * Validation layer for SmartInput entries.
 * Runs BEFORE the onChange mutation fires — never mutate with invalid values.
 *
 * All validators are pure functions (no side effects, no async).
 * Financial accuracy is critical — no silent coercions.
 */

import type { ValidationRule, ValidationResult } from '../../../../components/mobile-input/types';

/** Max allowed currency value — mirrors VALIDATION.AMOUNT_MAX from lib/validation */
export const SMART_INPUT_AMOUNT_MAX = 99_999_999;

/**
 * Validate a raw entry string against a ValidationRule.
 * Returns { valid: true } or { valid: false, errorMessage }.
 */
export function validateEntry(
  raw: string,
  rule: ValidationRule | undefined,
  numeric: number,
): ValidationResult {
  if (!rule) return { valid: true };

  // Required — must have a non-zero value
  if (rule.required) {
    if (!raw || raw === '0' || raw === '0.' || numeric === 0) {
      return { valid: false, errorMessage: 'This field is required' };
    }
  }

  // Must be finite
  if (!Number.isFinite(numeric)) {
    return { valid: false, errorMessage: 'Enter a valid number' };
  }

  // Positive only (> 0)
  if (rule.positiveOnly && numeric <= 0) {
    return { valid: false, errorMessage: 'Value must be greater than zero' };
  }

  // Minimum
  if (rule.min !== undefined && numeric < rule.min) {
    return {
      valid: false,
      errorMessage: `Minimum value is ${rule.min.toLocaleString('en-IN')}`,
    };
  }

  // Maximum
  const effectiveMax = rule.max ?? SMART_INPUT_AMOUNT_MAX;
  if (numeric > effectiveMax) {
    return {
      valid: false,
      errorMessage: `Maximum value is ${effectiveMax.toLocaleString('en-IN')}`,
    };
  }

  // Integer only — reject any decimal part
  if (rule.integerOnly && raw.includes('.')) {
    return { valid: false, errorMessage: 'Only whole numbers allowed' };
  }

  // Max decimal places
  if (rule.maxDecimalPlaces !== undefined && raw.includes('.')) {
    const decPart = raw.split('.')[1] ?? '';
    if (decPart.length > rule.maxDecimalPlaces) {
      return {
        valid: false,
        errorMessage: `Maximum ${rule.maxDecimalPlaces} decimal ${
          rule.maxDecimalPlaces === 1 ? 'place' : 'places'
        } allowed`,
      };
    }
  }

  // Custom validator
  if (rule.custom) {
    const msg = rule.custom(raw, numeric);
    if (msg) return { valid: false, errorMessage: msg };
  }

  return { valid: true };
}

/**
 * Quick check: is the raw string a submittable value?
 * Empty / zero / dot-only are considered not submittable.
 */
export function isSubmittable(raw: string): boolean {
  if (!raw || raw === '.' || raw === '0.') return false;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n !== 0;
}

/**
 * Derive a ValidationRule from SmartInputProps shorthand (required, min, max).
 * Merges with an explicit `validation` prop if provided.
 */
export function resolveValidationRule(opts: {
  required?: boolean;
  validation?: ValidationRule;
  allowDecimal?: boolean;
  maxDecimalPlaces?: 0 | 1 | 2;
}): ValidationRule | undefined {
  const base: ValidationRule = {};

  if (opts.required) base.required = true;
  if (opts.allowDecimal === false) base.integerOnly = true;
  if (opts.maxDecimalPlaces !== undefined) {
    base.maxDecimalPlaces = opts.maxDecimalPlaces;
  }

  const merged = { ...base, ...opts.validation };
  // Return undefined if nothing was set — avoids running empty validation
  return Object.keys(merged).length > 0 ? merged : undefined;
}
