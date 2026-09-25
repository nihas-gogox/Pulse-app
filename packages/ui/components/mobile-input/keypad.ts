/**
 * Pure string-based keypad engine.
 *
 * Financial accuracy contract:
 *   - All operations work on raw digit strings ("45000.5") — never on floats
 *   - No parseFloat on money; IEEE-754 cannot be trusted for currency arithmetic
 *   - No NaN, no Infinity, no empty coercions — every function returns a valid string
 *   - Long-press rapid-delete handled by the component layer, not here
 */

export type KeypadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.'
  | '⌫';

export interface KeypadOptions {
  /** Maximum digits in the integer part. Default: 9 (covers ₹99,999,999). */
  maxIntDigits?: number;
  /** Maximum decimal places. Default: 2. Pass 0 to force integer-only mode. */
  maxDecimalPlaces?: 0 | 1 | 2;
}

const DEFAULTS: Required<KeypadOptions> = {
  maxIntDigits: 9,
  maxDecimalPlaces: 2,
};

/**
 * Apply a single keypad key press to the current raw string.
 *
 * Rules enforced:
 *   - Leading zero prevention (typing "5" over "0" replaces it)
 *   - No double-zero at start
 *   - Single decimal point only
 *   - Max integer digits (default 9 — covers ₹9,99,99,999)
 *   - Max decimal places (configurable via opts)
 *   - Backspace removes one character (rapid delete is the caller's responsibility)
 */
export function applyKeypadPress(
  current: string,
  key: KeypadKey,
  opts?: KeypadOptions,
): string {
  const maxInt = opts?.maxIntDigits ?? DEFAULTS.maxIntDigits;
  const maxDec = opts?.maxDecimalPlaces ?? DEFAULTS.maxDecimalPlaces;

  // ── Backspace ──
  if (key === '⌫') {
    const next = current.slice(0, -1);
    return next;
  }

  // ── Decimal point ──
  if (key === '.') {
    if (maxDec === 0) return current;          // integer-only mode
    if (current.includes('.')) return current; // already has decimal
    if (!current || current === '0') return '0.';
    return current + '.';
  }

  // ── Digit ──
  const dotIdx = current.indexOf('.');

  if (dotIdx !== -1) {
    // Appending to decimal part
    const decLen = current.length - dotIdx - 1;
    if (decLen >= maxDec) return current;  // decimal precision lock
    return current + key;
  }

  // Integer part
  if (current === '0' && key !== '0') return key;    // replace leading zero
  if (current === '0' && key === '0') return current; // no double-zero
  if (current.length >= maxInt) return current;       // max digits guard
  return current + key;
}

/**
 * @deprecated Use `formatEntryDisplay` from `./formatters` — kept for backward compatibility.
 */
export { formatEntryDisplay as formatDisplayValue } from './formatters';

/**
 * Normalise any incoming `value` prop to a raw digit string.
 * Strips commas, trims whitespace, collapses zero states to ''.
 *
 * Zero states mapped to '' so the placeholder is shown in the entry screen:
 *   0, 0.0, 0.00, "", null, undefined → ''
 */
export function toRawString(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value).replace(/,/g, '').trim();
  // Treat zero as empty for entry — shows placeholder rather than "0"
  if (str === '0' || str === '0.0' || str === '0.00' || str === '0.000') return '';
  // Guard against NaN strings that might come from broken upstream state
  if (str === 'NaN' || str === 'Infinity' || str === '-Infinity') return '';
  return str;
}

/**
 * Parse a raw digit string to a JS number for display math and onChange callbacks.
 * Safe: never returns NaN or Infinity (falls back to 0).
 *
 * IMPORTANT: do not use the returned number for money arithmetic or DB writes.
 * Pass `raw` directly to mutation layers to preserve precision.
 */
export function parseRawToNumber(raw: string): number {
  if (!raw || raw === '.' || raw === '0.') return 0;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Prepare raw string for DB / mutation submission.
 * Strips trailing dot, normalises empty to '0'.
 *
 * Input:   "45000."  →  "45000"
 * Input:   "7.5"     →  "7.5"
 * Input:   ""        →  "0"
 * Input:   "0."      →  "0"
 */
export function rawToSubmitValue(raw: string): string {
  if (!raw) return '0';
  const trimmed = raw.endsWith('.') ? raw.slice(0, -1) : raw;
  if (!trimmed || trimmed === '-') return '0';
  return trimmed;
}

/**
 * Check if a raw string represents a value that can be submitted
 * (non-empty, non-zero, not just a dot).
 */
export function isKeypadValueSubmittable(raw: string): boolean {
  if (!raw || raw === '.' || raw === '0.' || raw === '0') return false;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0;
}
