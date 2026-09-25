// ─── Primary API ────────────────────────────────────────────────────────────
export { SmartInput } from './SmartInput';
export type { SmartInputProps, SmartInputType } from './SmartInput';

// ─── Trigger ─────────────────────────────────────────────────────────────────
export { SmartInputTrigger } from '@pulse/ui/components/mobile-input/SmartInputTrigger';
export type { SmartInputTriggerProps, TriggerValueColor, TriggerVariant } from '@pulse/ui/components/mobile-input/SmartInputTrigger';

// ─── Entry screen ────────────────────────────────────────────────────────────
export { FullscreenNumericEntry } from './FullscreenNumericEntry';
export type { FullscreenNumericEntryProps } from './FullscreenNumericEntry';
export { FullscreenTextEntry } from '@pulse/ui/components/mobile-input/FullscreenTextEntry';
export type { FullscreenTextEntryProps } from '@pulse/ui/components/mobile-input/FullscreenTextEntry';

// ─── Party banner ────────────────────────────────────────────────────────────
export { NumericEntryPartyBanner } from './NumericEntryPartyBanner';
export type { NumericEntryPartyPreview } from './NumericEntryPartyBanner';

// ─── Primitives ──────────────────────────────────────────────────────────────
export { DecimalKeypad, PAY_KEYPAD_CELL_PAD, PAY_KEYPAD_INSET } from '@pulse/ui/components/mobile-input/DecimalKeypad';
export { NumericDisplay } from '@pulse/ui/components/mobile-input/NumericDisplay';
export type { DisplayType } from '@pulse/ui/components/mobile-input/NumericDisplay';
export { BidVsTargetHint } from '@pulse/ui/components/mobile-input/BidVsTargetHint';
export { resolveBidVsTarget } from '@pulse/ui/components/mobile-input/bidVsTarget';
export type { BidVsTargetDelta, BidVsTargetTone } from '@pulse/ui/components/mobile-input/bidVsTarget';

// ─── Formatters ──────────────────────────────────────────────────────────────
export {
    formatDistanceDisplay, formatEntryDisplay, formatINRDisplay,
    formatPercentageDisplay, formatTriggerDisplay, formatWeightDisplay, getDefaultPrefix,
    getDefaultSuffix
} from '@pulse/ui/components/mobile-input/formatters';

// ─── Validation ──────────────────────────────────────────────────────────────
export { isSubmittable, resolveValidationRule, SMART_INPUT_AMOUNT_MAX, validateEntry } from '@pulse/ui/components/mobile-input/validation';

// ─── Keypad engine ───────────────────────────────────────────────────────────
export {
    applyKeypadPress,
    formatDisplayValue, isKeypadValueSubmittable, parseRawToNumber,
    rawToSubmitValue, toRawString
} from '@pulse/ui/components/mobile-input/keypad';
export type { KeypadKey, KeypadOptions } from '@pulse/ui/components/mobile-input/keypad';

// ─── Feedback ────────────────────────────────────────────────────────────────
export { triggerFeedback } from '@pulse/ui/components/mobile-input/feedback';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
    DesktopInputMode, EntryContext,
    FeedbackEvent, InputPlatform, KeypadKey as KeypadKeyType, NumericFormatOptions, SmartInputType as SmartInputTypeExtended,
    SmartInputVariant, ValidationResult, ValidationRule
} from '@pulse/domain/components/mobile-input/types';

// ─── Platform hook ───────────────────────────────────────────────────────────
export { useInputPlatform } from '@pulse/ui/components/mobile-input/useInputPlatform';
export { usePhysicalKeypadInput } from '@pulse/ui/components/mobile-input/usePhysicalKeypadInput';
export type { UsePhysicalKeypadInputOptions } from '@pulse/ui/components/mobile-input/usePhysicalKeypadInput';

