import { memo, type ReactNode, type RefObject } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useMobileWebStepLayout } from '@pulse/core/lib/hooks/useMobileWebStepLayout';
import { signupMobileWebScrollGestureProps } from '@pulse/domain/lib/signupMobileWebFormScroll';

import { SignUpPulseShell } from './SignUpPulseShell';
import { DRIVER_SIGNUP } from '@pulse/domain/features/auth/signup/signUpDriverTheme';
import { PULSE_SIGNUP } from '@pulse/domain/features/auth/signup/signUpPulseTheme';

export interface SignUpMobileShellProps {
  brandLabel?: string;
  backLabel?: string;
  onBack: () => void;
  stepLabels: readonly string[];
  currentStepIndex: number;
  hideProgress?: boolean;
  bodyMode?: 'scroll' | 'keypad';
  children: ReactNode;
  scrollBottomPad?: number;
  headerTitle?: string;
  headerSubtitle?: string;
  trustMode?: 'business' | 'driver';
  isDesktop?: boolean;
  brandWord?: string;
  marketingTag?: string;
  marketingTitle?: string;
  marketingOutcomeLines?: readonly string[];
  scrollRef?: RefObject<ScrollView | null>;
}

/**
 * Full-page mobile activation shell — business (purple) or driver (green).
 */
export const SignUpMobileShell = memo(function SignUpMobileShell({
  backLabel = 'Back',
  onBack,
  stepLabels,
  currentStepIndex,
  hideProgress = false,
  children,
  trustMode = 'business',
  isDesktop = false,
  brandWord,
  marketingTag,
  marketingTitle,
  marketingOutcomeLines,
  scrollRef,
  bodyMode = 'scroll',
  scrollBottomPad = 24,
}: SignUpMobileShellProps) {
  const theme = trustMode === 'driver' ? DRIVER_SIGNUP : PULSE_SIGNUP;
  const layout = useMobileWebStepLayout({
    extraScrollPadding: bodyMode === 'scroll' ? scrollBottomPad : 0,
  });
  const isMobileWeb = Platform.OS === 'web' && !isDesktop;
  const gestureProps = signupMobileWebScrollGestureProps({
    enabled: isMobileWeb && bodyMode === 'scroll',
    keyboardVisible: layout.keyboardVisible,
  });

  const body =
    bodyMode === 'scroll' ? (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.scrollPaddingBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...gestureProps}
      >
        {children}
      </ScrollView>
    ) : (
      children
    );

  return (
    <SignUpPulseShell
      onBack={onBack}
      backLabel={backLabel}
      currentStepIndex={currentStepIndex}
      stepLabels={stepLabels}
      hideProgress={hideProgress}
      isDesktop={isDesktop}
      theme={theme}
      brandWord={brandWord}
      marketingTag={marketingTag}
      marketingTitle={marketingTitle}
      marketingOutcomeLines={marketingOutcomeLines}
      edgeToEdgeBody={bodyMode === 'keypad'}
    >
      <View style={styles.body}>{body}</View>
    </SignUpPulseShell>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 4 : 8,
  },
});
