import { StyleSheet } from 'react-native';

import { PULSE_SIGNUP, type SignUpTheme } from './signUpPulseTheme';

/** Single typography scale for business signup — compact enterprise density. */
export const PULSE_SIGNUP_TYPO = {
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.22,
  },
  titleDesktop: {
    fontSize: 18,
    lineHeight: 24,
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.18,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    marginTop: 4,
  },
  subtitleCompact: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  brand: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    fontStyle: 'italic' as const,
    letterSpacing: -0.4,
  },
  back: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.45,
    textTransform: 'uppercase' as const,
  },
  input: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  display: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.8,
  },
  displayPrefix: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  hint: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '400' as const,
  },
  error: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  linkSmall: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
  },
  linkEmphasis: {
    fontWeight: '600' as const,
  },
  highlight: {
    fontWeight: '600' as const,
  },
  or: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
  },
  google: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  otpDigit: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  progressLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  progressLabelMobile: {
    fontSize: 8,
    lineHeight: 11,
  },
  pillLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
  },
  pillLabelSelected: {
    fontWeight: '600' as const,
  },
  pillSub: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '400' as const,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
  },
  bannerTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  bannerBody: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400' as const,
  },
} as const;

/**
 * Mobile activation flow — standard readable scale for phones.
 * Desktop keeps PULSE_SIGNUP_TYPO compact density.
 */
export const PULSE_SIGNUP_TYPO_MOBILE = {
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400' as const,
    marginTop: 6,
  },
  brand: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
    fontStyle: 'italic' as const,
    letterSpacing: -0.4,
  },
  back: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.42,
    textTransform: 'uppercase' as const,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  display: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500' as const,
    letterSpacing: 0.4,
  },
  displayPrefix: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400' as const,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400' as const,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500' as const,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  linkSmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  google: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  or: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  otpDigit: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  progressLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.35,
    textTransform: 'uppercase' as const,
  },
} as const;

export const SIGNUP_ERROR_COLOR = '#ef4444';

/** Theme-aware text styles for signup screens. */
export function createPulseSignUpTextStyles(theme: SignUpTheme = PULSE_SIGNUP) {
  return StyleSheet.create({
    title: {
      ...PULSE_SIGNUP_TYPO.title,
      color: theme.text,
      textAlign: 'center',
    },
    titleDesktop: PULSE_SIGNUP_TYPO.titleDesktop,
    titleCompact: PULSE_SIGNUP_TYPO.titleCompact,
    titleMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.title,
      color: theme.text,
      textAlign: 'center',
    },
    subtitle: {
      ...PULSE_SIGNUP_TYPO.subtitle,
      color: theme.muted,
      textAlign: 'center',
      maxWidth: 300,
      alignSelf: 'center',
    },
    subtitleDesktop: {
      maxWidth: 380,
    },
    subtitleCompact: PULSE_SIGNUP_TYPO.subtitleCompact,
    subtitleMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.subtitle,
      color: theme.muted,
      textAlign: 'center',
      maxWidth: 340,
      alignSelf: 'center',
    },
    subtitleCentered: {
      ...PULSE_SIGNUP_TYPO.subtitle,
      color: theme.muted,
      textAlign: 'center',
      maxWidth: 320,
      alignSelf: 'center',
      marginTop: 8,
    },
    highlight: {
      ...PULSE_SIGNUP_TYPO.highlight,
      color: theme.primaryDark,
    },
    brand: {
      ...PULSE_SIGNUP_TYPO.brand,
      color: theme.primaryDark,
    },
    brandMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.brand,
      color: theme.primaryDark,
    },
    back: {
      ...PULSE_SIGNUP_TYPO.back,
      color: theme.muted,
    },
    backMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.back,
      color: theme.muted,
    },
    fieldLabel: {
      ...PULSE_SIGNUP_TYPO.label,
      color: theme.muted,
      marginBottom: 5,
      paddingLeft: 2,
    },
    fieldLabelMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.label,
      color: theme.muted,
      marginBottom: 8,
      paddingLeft: 2,
    },
    input: {
      ...PULSE_SIGNUP_TYPO.input,
      color: theme.text,
    },
    inputMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.input,
      color: theme.text,
    },
    display: {
      ...PULSE_SIGNUP_TYPO.display,
      color: theme.text,
    },
    displayMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.display,
      color: theme.text,
    },
    displayPrefix: {
      ...PULSE_SIGNUP_TYPO.displayPrefix,
      color: theme.text,
    },
    displayPrefixMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.displayPrefix,
      color: theme.text,
    },
    placeholder: {
      color: theme.placeholder,
      fontWeight: '400',
    },
    body: {
      ...PULSE_SIGNUP_TYPO.body,
      color: theme.text,
    },
    bodyMedium: {
      ...PULSE_SIGNUP_TYPO.bodyMedium,
      color: theme.text,
    },
    bodyMuted: {
      ...PULSE_SIGNUP_TYPO.body,
      color: theme.muted,
    },
    caption: {
      ...PULSE_SIGNUP_TYPO.caption,
      color: theme.muted,
    },
    captionMedium: {
      ...PULSE_SIGNUP_TYPO.captionMedium,
      color: theme.muted,
    },
    hint: {
      ...PULSE_SIGNUP_TYPO.hint,
      color: theme.muted,
    },
    hintMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.hint,
      color: theme.muted,
    },
    error: {
      ...PULSE_SIGNUP_TYPO.error,
      color: SIGNUP_ERROR_COLOR,
    },
    errorMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.error,
      color: SIGNUP_ERROR_COLOR,
    },
    link: {
      ...PULSE_SIGNUP_TYPO.link,
      color: theme.primaryDark,
    },
    linkMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.link,
      color: theme.primaryDark,
    },
    linkSmall: {
      ...PULSE_SIGNUP_TYPO.linkSmall,
      color: theme.muted,
    },
    linkSmallMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.linkSmall,
      color: theme.muted,
    },
    linkEmphasis: {
      ...PULSE_SIGNUP_TYPO.linkEmphasis,
      color: theme.primaryDark,
    },
    or: {
      ...PULSE_SIGNUP_TYPO.or,
      color: theme.muted,
    },
    orMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.or,
      color: theme.muted,
    },
    google: {
      ...PULSE_SIGNUP_TYPO.google,
      color: theme.text,
    },
    googleMobile: {
      ...PULSE_SIGNUP_TYPO_MOBILE.google,
      color: theme.text,
    },
    otpDigit: PULSE_SIGNUP_TYPO.otpDigit,
    otpDigitMobile: PULSE_SIGNUP_TYPO_MOBILE.otpDigit,
    otpDigitFilled: {
      ...PULSE_SIGNUP_TYPO.otpDigit,
      color: theme.primaryDark,
    },
    progressLabel: {
      ...PULSE_SIGNUP_TYPO.progressLabel,
      color: theme.muted,
    },
    progressLabelActive: {
      color: theme.primaryDark,
      fontWeight: '600',
    },
    pillLabel: {
      ...PULSE_SIGNUP_TYPO.pillLabel,
      color: theme.text,
    },
    pillLabelSelected: {
      ...PULSE_SIGNUP_TYPO.pillLabelSelected,
      color: theme.primaryDark,
    },
    pillSub: {
      ...PULSE_SIGNUP_TYPO.pillSub,
      color: theme.muted,
    },
    pillSubSelected: {
      ...PULSE_SIGNUP_TYPO.pillSub,
      color: theme.primaryDark,
      fontWeight: '500',
    },
    avatarInitials: {
      ...PULSE_SIGNUP_TYPO.avatarInitials,
      color: theme.primaryDark,
    },
    secondaryLink: {
      ...PULSE_SIGNUP_TYPO.linkSmall,
      color: theme.primaryDark,
      fontWeight: '600',
    },
  });
}

/** Default text styles (PULSE_SIGNUP theme). */
export const SIGNUP_TEXT = createPulseSignUpTextStyles(PULSE_SIGNUP);
