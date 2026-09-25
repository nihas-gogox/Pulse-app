/**
 * Type contracts for the SmartInput platform primitive.
 * All other mobile-input modules import from here — never from each other.
 */

// ─── Input semantics ────────────────────────────────────────────────────────

/** What kind of value is being entered. Drives prefix/suffix defaults and formatter. */
export type SmartInputType =
  | 'currency'    // ₹ amounts — Indian locale, 2 decimal places max
  | 'numeric'     // generic number — no prefix
  | 'percentage'  // 0-100 — % suffix
  | 'quantity'    // integer counts (e.g. number of bags)
  | 'weight'      // decimal tons / kg
  | 'distance';   // km, decimal

// ─── Layout / UX ────────────────────────────────────────────────────────────

/** Trigger field appearance. */
export type SmartInputVariant = 'row' | 'field';

/** How the entry screen is presented on mobile (always fullscreen) vs desktop. */
export type DesktopInputMode = 'drawer' | 'modal';

/** Platform bucket used for entry presentation. */
export type InputPlatform = 'mobile' | 'tablet' | 'desktop';

// ─── Formatting ─────────────────────────────────────────────────────────────

export interface NumericFormatOptions {
  /** BCP-47 locale tag. Defaults to 'en-IN'. */
  locale?: string;
  /** Fixed decimal places in display. */
  decimalPlaces?: 0 | 1 | 2;
  /** Use compact notation (₹1.2L, ₹50K). Only valid for display, not entry. */
  compact?: boolean;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationRule {
  /** Value must be present and non-zero. */
  required?: boolean;
  /** Minimum allowed numeric value (inclusive). */
  min?: number;
  /** Maximum allowed numeric value (inclusive). Defaults to AMOUNT_MAX for currency. */
  max?: number;
  /** Reject any decimal input — only whole numbers accepted. */
  integerOnly?: boolean;
  /** Value must be strictly positive (> 0). */
  positiveOnly?: boolean;
  /** Maximum decimal places allowed (0 = integer, 1 or 2). */
  maxDecimalPlaces?: 0 | 1 | 2;
  /** Custom validator — return an error message string or undefined if valid. */
  custom?: (raw: string, numeric: number) => string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
}

// ─── Entry context ───────────────────────────────────────────────────────────

/** Rich context shown in the entry header below the label. */
export interface EntryContext {
  /** Primary context line — e.g. "Trip: BLR → CHN" */
  primary: string;
  /** Optional secondary line — e.g. "Supplier: XYZ Transport" */
  secondary?: string;
}

// ─── Haptic / feedback ───────────────────────────────────────────────────────

export type FeedbackEvent = 'keyPress' | 'apply' | 'delete' | 'error';

// ─── Keypad ──────────────────────────────────────────────────────────────────

export type KeypadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.'
  | '⌫';

// ─── Component props ────────────────────────────────────────────────────────

export interface SmartInputProps {
  /** Semantic type — determines prefix/suffix defaults and formatter. */
  type?: SmartInputType;
  /** Current value. Pass `undefined` / `0` / `''` for empty state. */
  value?: number | string;
  /**
   * Called when the user confirms a new value.
   * @param raw     Clean digit string, e.g. "45000" or "7.5"
   * @param numeric Parsed JS number — use for display math, not DB writes
   */
  onChange: (raw: string, numeric: number) => void;
  /** Shown in the trigger field and as the entry header. */
  label: string;
  /**
   * Secondary context shown beneath the label in the entry header.
   * Pass a string for a single line or an EntryContext for two lines.
   */
  context?: string | EntryContext;
  /** Trigger layout variant. Default: 'row'. */
  variant?: SmartInputVariant;
  placeholder?: string;
  /** Override auto prefix (currency → '₹'). Pass '' to suppress. */
  prefix?: string;
  /** Override auto suffix (percentage → '%'). Pass '' to suppress. */
  suffix?: string;
  /** CTA label inside the entry screen. Default: 'Apply'. */
  submitLabel?: string;
  /** Whether to allow decimal input. Default: true. */
  allowDecimal?: boolean;
  /** Maximum decimal places (0-2). Ignored when allowDecimal is false. */
  maxDecimalPlaces?: 0 | 1 | 2;
  /** Inline validation rules evaluated before onChange fires. */
  validation?: ValidationRule;
  /**
   * Colour the displayed value in the trigger.
   * 'auto' → positive (green) if > 0, negative (red) if < 0.
   */
  valueColor?: 'default' | 'positive' | 'negative' | 'auto';
  disabled?: boolean;
  required?: boolean;
  /** External error message from form validation (displayed below the trigger). */
  errorMessage?: string;
}
