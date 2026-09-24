import Theme from '@pulse/core/constants/Theme';

import type { SignUpTheme } from './signUpPulseTheme';

/** Driver workforce signup — matches in-app driver emerald (#047857). */
export const DRIVER_SIGNUP: SignUpTheme = {
  primary: Theme.driverEmerald,
  primaryDark: Theme.driverEmeraldDark,
  primaryLight: Theme.driverPrimary,
  primaryTint: Theme.driverEmeraldMuted,
  primaryButtonText: Theme.textOnPrimary,
  canvas: '#f3f4f6',
  bg: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  placeholder: '#94a3b8',
  border: '#e2e8f0',
  borderFocus: Theme.driverEmerald,
  surface: '#f8fafc',
  keypadTray: '#f8fafc',
  disabledBg: '#f1f5f9',
  disabledText: '#94a3b8',
  deviceBorder: '#111111',
};
