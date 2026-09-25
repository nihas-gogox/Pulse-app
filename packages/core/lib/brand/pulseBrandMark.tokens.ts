import Theme from '../../constants/Theme';

/** Canonical pulse platform wordmark — always lowercase. */
export const PULSE_BRAND_MARK_WORD = 'pulse';

/** Product wordmarks — same typography, yellow dot on period. */
export const PULSE_CORE_BRAND_WORD = 'pulsecore';
export const PULSE_PILOT_BRAND_WORD = 'pulsepilot';
export const PULSE_COMMERCE_BRAND_WORD = 'pulsecommerce';
export const PULSE_INVOICE_BRAND_WORD = 'pulseinvoice';
export const PULSE_POD_BRAND_WORD = 'pulsepod';
export const PULSE_FINANCE_PRO_BRAND_WORD = 'pulsefinancepro';

export type PulseProductBrandId = 'core' | 'pilot' | 'commerce' | 'invoice' | 'pod' | 'finance-pro';

export function pulseProductBrandWord(productId: PulseProductBrandId): string {
  if (productId === 'pilot') return PULSE_PILOT_BRAND_WORD;
  if (productId === 'commerce') return PULSE_COMMERCE_BRAND_WORD;
  if (productId === 'invoice') return PULSE_INVOICE_BRAND_WORD;
  if (productId === 'pod') return PULSE_POD_BRAND_WORD;
  if (productId === 'finance-pro') return PULSE_FINANCE_PRO_BRAND_WORD;
  return PULSE_CORE_BRAND_WORD;
}

export const PULSE_BRAND_MARK_TYPO = {
  fontWeight: '700' as const,
  fontStyle: 'italic' as const,
};

export const PULSE_BRAND_MARK_COLORS = {
  ink: {
    word: Theme.brandBlueInk,
    dot: Theme.accentGold,
  },
  onDark: {
    word: '#FFFFFF',
    dot: Theme.accentGold,
  },
} as const;

export type PulseBrandMarkSize =
  | 'xs'
  | 'sm'
  | 'smMobile'
  | 'md'
  | 'lg'
  | 'xl'
  | 'display';

export const PULSE_BRAND_MARK_SIZES: Record<
  PulseBrandMarkSize,
  { fontSize: number; lineHeight: number; letterSpacing: number }
> = {
  xs: { fontSize: 11, lineHeight: 14, letterSpacing: -0.2 },
  sm: { fontSize: 15, lineHeight: 20, letterSpacing: -0.4 },
  smMobile: { fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  md: { fontSize: 18, lineHeight: 22, letterSpacing: -0.4 },
  lg: { fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  xl: { fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  display: { fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
};
