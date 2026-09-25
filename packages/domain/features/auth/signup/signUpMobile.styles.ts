import Theme from '@pulse/core/constants/Theme';
import { Platform, StyleSheet } from 'react-native';

import { DRIVER_SIGNUP } from './signUpDriverTheme';
import { SIGNUP_MOBILE_TOKENS as T } from './signUpMobileTokens';
import { PULSE_SIGNUP_TYPO } from './signUpTypography';

/** Driver mobile shell palette — aligned with DRIVER_SIGNUP theme tokens. */
export const SIGNUP_MOBILE = {
  accent: DRIVER_SIGNUP.primary,
  bg: DRIVER_SIGNUP.bg,
  text: DRIVER_SIGNUP.text,
  muted: DRIVER_SIGNUP.muted,
  border: DRIVER_SIGNUP.border,
  placeholder: DRIVER_SIGNUP.placeholder,
  surface: DRIVER_SIGNUP.surface,
  keypadTray: DRIVER_SIGNUP.keypadTray,
} as const;

/** Centered column used in keypad + scroll steps. */
export const signUpMobileContentInner = {
  width: '100%' as const,
  maxWidth: T.contentMaxWidth,
  alignSelf: 'center' as const,
  paddingHorizontal: T.padH,
};

export const signUpMobileStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SIGNUP_MOBILE.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.padH,
    paddingTop: 2,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 68,
    paddingVertical: 4,
  },
  backBtnText: {
    ...PULSE_SIGNUP_TYPO.back,
    color: SIGNUP_MOBILE.muted,
  },
  brandText: {
    ...PULSE_SIGNUP_TYPO.brand,
    color: DRIVER_SIGNUP.primaryDark,
  },
  topBarSpacer: {
    minWidth: 68,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyKeypad: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 20,
    ...signUpMobileContentInner,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: T.progressPadTop,
    paddingHorizontal: T.padH,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SIGNUP_MOBILE.border,
    backgroundColor: SIGNUP_MOBILE.bg,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    paddingHorizontal: 1,
  },
  progressBar: {
    width: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: SIGNUP_MOBILE.border,
  },
  progressBarActive: {
    width: 22,
    height: 3,
    backgroundColor: SIGNUP_MOBILE.accent,
  },
  progressBarDone: {
    width: 10,
    backgroundColor: SIGNUP_MOBILE.accent,
    opacity: 0.45,
  },
  progressLabel: {
    ...PULSE_SIGNUP_TYPO.progressLabelMobile,
    fontWeight: '600',
    color: SIGNUP_MOBILE.muted,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: SIGNUP_MOBILE.accent,
    fontWeight: '600',
  },
  mobileTitle: {
    ...PULSE_SIGNUP_TYPO.title,
    color: SIGNUP_MOBILE.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  mobileSubtitle: {
    ...PULSE_SIGNUP_TYPO.subtitle,
    color: SIGNUP_MOBILE.muted,
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },
  heroBlock: {
    alignItems: 'center',
    paddingBottom: T.heroPadBottom,
  },
  stepTitle: {
    ...PULSE_SIGNUP_TYPO.title,
    color: SIGNUP_MOBILE.text,
    marginBottom: 6,
  },
  stepSub: {
    ...PULSE_SIGNUP_TYPO.subtitle,
    color: SIGNUP_MOBILE.muted,
    marginBottom: 16,
  },
  fieldLabel: {
    ...PULSE_SIGNUP_TYPO.label,
    color: SIGNUP_MOBILE.muted,
    marginBottom: 8,
    paddingLeft: 2,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SIGNUP_MOBILE.border,
    borderRadius: T.inputRadius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: T.displayMinHeight,
    backgroundColor: SIGNUP_MOBILE.bg,
  },
  displayRowError: {
    borderColor: Theme.destructive,
    backgroundColor: '#fef2f2',
  },
  flag: {
    fontSize: T.flagSize,
    marginRight: 6,
  },
  dialCode: {
    ...PULSE_SIGNUP_TYPO.displayPrefix,
    color: SIGNUP_MOBILE.muted,
    marginRight: 6,
  },
  displayValue: {
    flex: 1,
    ...PULSE_SIGNUP_TYPO.display,
    minWidth: 0,
  },
  displayPlaceholder: {
    color: SIGNUP_MOBILE.placeholder,
    fontWeight: '400',
  },
  input: {
    borderWidth: 1,
    borderColor: SIGNUP_MOBILE.border,
    borderRadius: T.inputRadius,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 11 : 12,
    ...PULSE_SIGNUP_TYPO.input,
    backgroundColor: SIGNUP_MOBILE.bg,
    minHeight: T.inputMinHeight,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
    }),
  },
  inputError: {
    borderColor: Theme.destructive,
    backgroundColor: '#fef2f2',
  },
  primaryBtn: {
    backgroundColor: SIGNUP_MOBILE.accent,
    borderRadius: T.btnRadius,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    ...PULSE_SIGNUP_TYPO.link,
    color: Theme.buttonPrimaryText,
    fontWeight: '600',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: T.orMarginV,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: SIGNUP_MOBILE.border,
  },
  orText: {
    ...PULSE_SIGNUP_TYPO.or,
    color: SIGNUP_MOBILE.muted,
  },
  googleBtn: {
    borderRadius: T.btnRadius,
    paddingVertical: T.googleBtnPaddingV,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: SIGNUP_MOBILE.border,
    backgroundColor: SIGNUP_MOBILE.bg,
    minHeight: 44,
  },
  googleBtnText: {
    ...PULSE_SIGNUP_TYPO.google,
    color: SIGNUP_MOBILE.text,
  },
  altRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: T.altMarginTop,
    flexWrap: 'wrap',
  },
  altText: {
    ...PULSE_SIGNUP_TYPO.linkSmall,
    color: SIGNUP_MOBILE.muted,
  },
  altLink: {
    ...PULSE_SIGNUP_TYPO.linkSmall,
    color: DRIVER_SIGNUP.primaryDark,
    fontWeight: '600',
  },
  fieldError: {
    ...PULSE_SIGNUP_TYPO.error,
    marginTop: 6,
  },
  fieldHint: {
    ...PULSE_SIGNUP_TYPO.hint,
    marginTop: 6,
  },
  docActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: T.btnRadius,
    borderWidth: 1,
    borderColor: SIGNUP_MOBILE.border,
    backgroundColor: SIGNUP_MOBILE.bg,
    flex: 1,
    minHeight: 44,
  },
  docActionText: {
    ...PULSE_SIGNUP_TYPO.captionMedium,
    color: SIGNUP_MOBILE.text,
    fontWeight: '500',
  },
  docActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  docStatus: {
    ...PULSE_SIGNUP_TYPO.caption,
    marginBottom: 12,
    textAlign: 'center',
  },
  docStatusDone: {
    color: DRIVER_SIGNUP.primaryDark,
    fontWeight: '500',
  },
  docStatusPending: {
    color: SIGNUP_MOBILE.muted,
  },
  linkText: {
    ...PULSE_SIGNUP_TYPO.linkSmall,
    color: DRIVER_SIGNUP.primaryDark,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  keypadDock: {
    width: '100%',
    backgroundColor: SIGNUP_MOBILE.keypadTray,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SIGNUP_MOBILE.border,
    paddingTop: 4,
  },
});
