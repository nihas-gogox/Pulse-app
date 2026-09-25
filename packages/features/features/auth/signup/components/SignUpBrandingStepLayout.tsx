import { memo, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMobileWebStepLayout } from '@pulse/core/lib/hooks/useMobileWebStepLayout';
import { signupMobileWebScrollGestureProps } from '@pulse/domain/lib/signupMobileWebFormScroll';

import { SignUpPulsePrimaryButton } from '../SignUpPulsePrimaryButton';
import { SignUpPulseTitle } from '../SignUpPulseTitle';
import { PULSE_SIGNUP, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { SIGNUP_TEXT } from '@pulse/domain/features/auth/signup/signUpTypography';

export interface SignUpBrandingStepLayoutProps {
  title: string;
  subtitle?: string | ReactNode;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
  theme?: SignUpTheme;
}

/** Full-page branding step — scroll body + docked footer (logo / profile photo). */
export const SignUpBrandingStepLayout = memo(function SignUpBrandingStepLayout({
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  skipLabel = 'Skip for now',
  onSkip,
  theme = PULSE_SIGNUP,
}: SignUpBrandingStepLayoutProps) {
  const layout = useMobileWebStepLayout();
  const isMobileWeb = Platform.OS === 'web' && !layout.isDesktop;
  const gestureProps = signupMobileWebScrollGestureProps({
    enabled: isMobileWeb,
    keyboardVisible: layout.keyboardVisible,
  });

  return (
    <View style={[styles.root, layout.rootStyle]}>
      <ScrollView
        style={[styles.scroll, { marginBottom: layout.scrollClearance }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.scrollPaddingBottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...gestureProps}
      >
        <SignUpPulseTitle title={title} subtitle={subtitle} />
        {children}
      </ScrollView>

      <View
        style={[
          styles.footer,
          layout.footerStyle,
          { borderTopColor: theme.border, backgroundColor: theme.bg },
        ]}
      >
        <SignUpPulsePrimaryButton
          label={primaryLabel}
          onPress={onPrimary}
          loading={primaryLoading}
          disabled={primaryDisabled}
        />
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.skip, { color: theme.muted }]}>{skipLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'web' ? 20 : 24,
    paddingTop: Platform.OS === 'web' ? 4 : 8,
  },
  footer: {
    paddingHorizontal: Platform.OS === 'web' ? 20 : 24,
    paddingTop: Platform.OS === 'web' ? 10 : 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skip: {
    ...SIGNUP_TEXT.linkSmall,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
