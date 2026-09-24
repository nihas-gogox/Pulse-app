import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';

import { useMobileWebStepLayout } from '@pulse/core/lib/hooks/useMobileWebStepLayout';
import { useViewportWidth } from '@pulse/core/lib/hooks/useViewportWidth';
import {
  scrollSignupFormFieldIntoView,
  signupMobileWebScrollGestureProps,
} from '@pulse/domain/lib/signupMobileWebFormScroll';
import { shouldAvoidWebKeyboardFormReflow } from '@pulse/core/lib/webKeyboard';

import { SignUpPulseFormStepProvider, type ScrollFieldIntoViewOptions } from '@pulse/ui/features/auth/signup/SignUpPulseFormStepContext';
import { SignUpPulsePrimaryButton } from './SignUpPulsePrimaryButton';
import { SignUpPulseTitle } from './SignUpPulseTitle';
import { DESKTOP_BREAKPOINT } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles } from '@pulse/domain/features/auth/signup/signUpTypography';

export interface SignUpPulseFormStepProps {
  title: string;
  subtitle?: string | ReactNode;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  footerAccessory?: ReactNode;
  inlinePrimary?: boolean;
  /** Vertically center scroll content (success / celebration steps). */
  centerContent?: boolean;
  /** Title alignment — desktop defaults to left. */
  titleCentered?: boolean;
  /** Extra bottom padding (e.g. clear fixed progress rail on Account step). */
  scrollPaddingBottom?: number;
  /**
   * @deprecated All form steps are keyboard-aware by default on mobile web and native.
   */
  keyboardAware?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  theme?: SignUpTheme;
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  customFooter?: ReactNode;
}

export const SignUpPulseFormStep = memo(function SignUpPulseFormStep({
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  footerAccessory,
  inlinePrimary = false,
  centerContent = false,
  titleCentered = false,
  scrollPaddingBottom = 0,
  scrollRef: scrollRefProp,
  theme = PULSE_SIGNUP,
  secondaryAction,
  customFooter,
}: SignUpPulseFormStepProps) {
  const width = useViewportWidth();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const textStyles = useMemo(() => createPulseSignUpTextStyles(theme), [theme]);

  const layout = useMobileWebStepLayout({
    extraScrollPadding: scrollPaddingBottom,
    inlinePrimary,
  });

  const internalScrollRef = useRef<ScrollView>(null);
  const scrollRef = scrollRefProp ?? internalScrollRef;

  const lastFocusedFieldRef = useRef<RefObject<RNView | null> | null>(null);
  const lastScrollPadRef = useRef<number | undefined>(undefined);

  const scrollFieldIntoView = useCallback(
    (fieldRef: RefObject<RNView | null>, options?: ScrollFieldIntoViewOptions) => {
      lastFocusedFieldRef.current = fieldRef;
      const extraBottomPad = options?.extraBottomPad ?? (isDesktop ? 16 : 48);
      lastScrollPadRef.current = extraBottomPad;
      scrollSignupFormFieldIntoView(scrollRef, fieldRef, {
        keyboardHeight: layout.keyboardInset,
        headerOffset: isDesktop ? 20 : 72,
        extraBottomPad,
        animated: isDesktop,
      });
    },
    [scrollRef, layout.keyboardInset, isDesktop],
  );

  useEffect(() => {
    // Only re-scroll when the keyboard *opens* — not on every keyboardInset tick.
    // Android Chrome: this second scroll (after onFocus already scrolled, or
    // after Chrome's own caret pan) blurs the field and closes the keyboard.
    if (
      !layout.keyboardVisible ||
      !lastFocusedFieldRef.current ||
      shouldAvoidWebKeyboardFormReflow()
    ) {
      return;
    }
    scrollSignupFormFieldIntoView(scrollRef, lastFocusedFieldRef.current, {
      keyboardHeight: layout.keyboardInset,
      headerOffset: isDesktop ? 20 : 72,
      extraBottomPad: lastScrollPadRef.current ?? (isDesktop ? 16 : 48),
      animated: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyboard open edge only
  }, [layout.keyboardVisible, scrollRef, isDesktop]);

  const clearLastFocused = useCallback(() => {
    lastFocusedFieldRef.current = null;
  }, []);

  const gestureProps = useMemo(
    () =>
      signupMobileWebScrollGestureProps({
        enabled: Platform.OS === 'web' && !isDesktop,
        keyboardVisible: layout.keyboardVisible,
        onDismiss: clearLastFocused,
      }),
    [isDesktop, layout.keyboardVisible, clearLastFocused],
  );

  const cta = customFooter ?? (
    <View style={styles.ctaBlock}>
      {footerAccessory}
      <SignUpPulsePrimaryButton
        label={primaryLabel}
        onPress={onPrimary}
        disabled={primaryDisabled}
        loading={primaryLoading}
        theme={theme}
      />
      {secondaryAction ? (
        <Pressable onPress={secondaryAction.onPress} style={styles.secondaryLink}>
          <Text style={textStyles.secondaryLink}>{secondaryAction.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const scroll = (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { marginBottom: layout.scrollClearance }]}
      contentContainerStyle={[
        styles.scrollContent,
        !isDesktop && styles.scrollContentMobile,
        isDesktop && styles.scrollContentDesktop,
        { paddingBottom: layout.scrollPaddingBottom },
        centerContent && styles.scrollContentCentered,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...gestureProps}
    >
      <SignUpPulseTitle title={title} subtitle={subtitle} centered={titleCentered} />
      {children}
      {layout.showCtaInScroll ? cta : null}
    </ScrollView>
  );

  const useNativeKeyboardAvoid = Platform.OS !== 'web';

  return (
    <SignUpPulseFormStepProvider
      onPrimary={onPrimary}
      primaryDisabled={primaryDisabled}
      primaryLoading={primaryLoading}
      scrollFieldIntoView={scrollFieldIntoView}
    >
      <View style={[styles.root, layout.rootStyle]}>
        {useNativeKeyboardAvoid ? (
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? layout.insets.top + 52 : 0}
          >
            {scroll}
          </KeyboardAvoidingView>
        ) : (
          scroll
        )}
        {!layout.showCtaInScroll ? (
          <View
            style={[
              styles.footer,
              isDesktop && styles.footerDesktop,
              !isDesktop && styles.footerMobile,
              layout.footerStyle,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.bg,
              },
            ]}
          >
            {cta}
          </View>
        ) : null}
      </View>
    </SignUpPulseFormStepProvider>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  keyboardAvoid: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 4 : 2,
  },
  scrollContentMobile: {
    alignItems: 'center',
  },
  scrollContentDesktop: {
    paddingHorizontal: 0,
    paddingTop: 10,
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
  },
  footerDesktop: {
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerMobile: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  ctaBlock: {
    gap: 8,
    width: '100%',
    maxWidth: 360,
    minWidth: 0,
    alignSelf: 'center',
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
