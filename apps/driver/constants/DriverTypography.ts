import type { TextStyle } from 'react-native';

/**
 * Plus Jakarta Sans — loaded in `app/(driver)/_layout.tsx`.
 * PostScript names must match `useFonts({ ... })` keys from `@expo-google-fonts/plus-jakarta-sans`.
 */
export const DriverFontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Wallet trip row secondary line (route / meta): regular + tracking — match existing sizes/weights via merge order.
 */
export const driverBodySecondary: TextStyle = {
  fontFamily: DriverFontFamily.regular,
  letterSpacing: 0.1,
};

/** Primary title line on compact rows (15/500 etc.) */
export const driverBodyPrimary: TextStyle = {
  fontFamily: DriverFontFamily.medium,
  letterSpacing: 0.05,
};

export const driverUISemiBold: TextStyle = {
  fontFamily: DriverFontFamily.semiBold,
  letterSpacing: 0.08,
};

export const driverUIBold: TextStyle = {
  fontFamily: DriverFontFamily.bold,
  letterSpacing: 0.06,
};

export const driverUIExtraBold: TextStyle = {
  fontFamily: DriverFontFamily.extraBold,
  letterSpacing: 0.06,
};

/** Tab bar micro labels — keeps Typography sizing; adds family only */
export const driverTabMicroLabel: TextStyle = {
  fontFamily: DriverFontFamily.bold,
};
