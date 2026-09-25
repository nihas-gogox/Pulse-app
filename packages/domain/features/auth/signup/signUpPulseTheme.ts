import Theme from '@pulse/core/constants/Theme';

export type SignUpTheme = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryTint: string;
  /** Label on filled primary buttons (defaults to Theme.buttonPrimaryText). */
  primaryButtonText?: string;
  canvas: string;
  bg: string;
  text: string;
  muted: string;
  placeholder: string;
  border: string;
  borderFocus: string;
  surface: string;
  keypadTray: string;
  disabledBg: string;
  disabledText: string;
  deviceBorder: string;
};

/** Business / workspace signup — Pulse pastel blue + ink. */
export const PULSE_SIGNUP: SignUpTheme = {
  primary: Theme.actionAccent,
  primaryDark: Theme.actionAccentBorder,
  primaryLight: Theme.primaryLight,
  primaryTint: Theme.brandBlueSoft,
  canvas: '#f3f4f6',
  bg: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  placeholder: '#d1d5db',
  border: '#e5e7eb',
  borderFocus: Theme.actionAccent,
  surface: Theme.analyticsCanvas,
  keypadTray: Theme.analyticsCanvas,
  disabledBg: '#f3f4f6',
  disabledText: '#6b7280',
  deviceBorder: '#111111',
};

export const PULSE_SIGNUP_RADIUS = {
  input: 16,
  button: 999,
  pill: 14,
  card: 20,
  device: 48,
  keypadTray: 32,
} as const;
