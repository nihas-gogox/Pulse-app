/**
 * Centralized formatters for the SmartInput system.
 *
 * All formatting flows through here. Never call Intl / toLocaleString
 * directly in display components — this is the single source of truth
 * for numeric presentation across the transactional entry layer.
 *
 * Design principles:
 *   - Pure functions only — no side effects
 *   - Locale defaults to 'en-IN' (Indian number system)
 *   - Never throw — always return a display-safe string
 *   - Separate entry-time formatting from display formatting
 */

import type { SmartInputType, NumericFormatOptions } from '../../../../components/mobile-input/types';

const DEFAULT_LOCALE = 'en-IN';

// ─── Entry-time (raw string) formatting ─────────────────────────────────────

/**
 * Format a raw digit string for display inside the entry screen.
 * Preserves trailing dot so the user can see they started entering decimals.
 *
 * Input:  "45000.5"  →  Output: "45,000.5"
 * Input:  "45000."   →  Output: "45,000."
 * Input:  ""         →  Output: ""
 */
export function formatEntryDisplay(
  raw: string,
  _type: SmartInputType = 'currency',
  _opts?: NumericFormatOptions,
): string {
  if (!raw) return '';
  const locale = _opts?.locale ?? DEFAULT_LOCALE;
  const hasDot = raw.includes('.');
  const [intStr, decStr] = raw.split('.');

  const intNum = parseInt(intStr || '0', 10);
  const formattedInt = Number.isNaN(intNum)
    ? '0'
    : intNum.toLocaleString(locale);

  return hasDot ? `${formattedInt}.${decStr ?? ''}` : formattedInt;
}

// ─── Trigger display formatting ──────────────────────────────────────────────

/**
 * Format a value for display in the trigger field (compact, no trailing dot).
 *
 * Input:  45000         →  "45,000"
 * Input:  45000.5       →  "45,000.50" (currency)
 * Input:  "45000"       →  "45,000"
 * Input:  0 / '' / null →  "" (empty → placeholder shown)
 */
export function formatTriggerDisplay(
  value: number | string | undefined | null,
  type: SmartInputType = 'currency',
  opts?: NumericFormatOptions,
): string {
  if (value === undefined || value === null || value === '' || value === 0) {
    return '';
  }
  const raw = String(value).replace(/,/g, '').trim();
  if (!raw || raw === '0' || raw === '0.00' || raw === '0.0') return '';

  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return '';

  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const decimalPlaces = opts?.decimalPlaces ?? getDefaultDecimalPlaces(type);

  if (opts?.compact) {
    return formatCompact(n, type, locale);
  }

  return n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalPlaces,
  });
}

/**
 * Full INR format for display outside entry flows (e.g. receipts, summaries).
 * Adds the ₹ symbol with a space.
 */
export function formatINRDisplay(
  value: number | string,
  opts?: NumericFormatOptions,
): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '₹ 0';

  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const dp = opts?.decimalPlaces ?? 0;

  if (opts?.compact) {
    return `₹ ${formatCompact(n, 'currency', locale)}`;
  }

  const formatted = n.toLocaleString(locale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return `₹ ${formatted}`;
}

/** Percentage display — "12.5%" */
export function formatPercentageDisplay(
  value: number | string,
  opts?: NumericFormatOptions,
): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return '0%';
  const dp = opts?.decimalPlaces ?? 1;
  return `${n.toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  })}%`;
}

/** Weight display — "7.5 T" */
export function formatWeightDisplay(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n === 0) return '';
  return `${n.toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} T`;
}

/** Distance display — "124 km" */
export function formatDistanceDisplay(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n === 0) return '';
  return `${n.toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} km`;
}

// ─── Auto-resolve prefix / suffix from type ──────────────────────────────────

/** Default display prefix for a SmartInputType. */
export function getDefaultPrefix(type: SmartInputType): string {
  switch (type) {
    case 'currency': return '₹';
    default: return '';
  }
}

/** Default display suffix for a SmartInputType. */
export function getDefaultSuffix(type: SmartInputType): string {
  switch (type) {
    case 'percentage': return '%';
    case 'weight': return ' T';
    case 'distance': return ' km';
    default: return '';
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function getDefaultDecimalPlaces(type: SmartInputType): number {
  switch (type) {
    case 'quantity': return 0;
    case 'currency': return 2;
    case 'percentage': return 1;
    case 'weight': return 1;
    case 'distance': return 0;
    default: return 2;
  }
}

function formatCompact(n: number, _type: SmartInputType, locale: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_00_00_000) {
    const cr = abs / 1_00_00_000;
    return `${sign}${(cr >= 10 ? Math.round(cr) : cr.toFixed(1)).toLocaleString(locale)} Cr`;
  }
  if (abs >= 1_00_000) {
    const L = abs / 1_00_000;
    return `${sign}${(L >= 10 ? Math.round(L) : L.toFixed(1)).toLocaleString(locale)} L`;
  }
  if (abs >= 1_000) {
    const K = abs / 1_000;
    return `${sign}${(K >= 100 ? Math.round(K) : K.toFixed(K >= 10 ? 0 : 1)).toLocaleString(locale)} K`;
  }
  return `${sign}${abs.toLocaleString(locale)}`;
}
