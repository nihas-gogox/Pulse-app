import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DESKTOP_BREAKPOINT } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles } from '@pulse/domain/features/auth/signup/signUpTypography';

export interface SignUpPulseTitleProps {
  title: string;
  subtitle?: string | ReactNode;
  centered?: boolean;
  compact?: boolean;
}

export const SignUpPulseTitle = memo(function SignUpPulseTitle({
  title,
  subtitle,
  centered = true,
  compact = false,
}: SignUpPulseTitleProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const text = createPulseSignUpTextStyles(PULSE_SIGNUP);
  const isMobile = !isDesktop;
  const compactType = compact && isDesktop;

  return (
    <View style={[styles.wrap, centered && styles.centered, isMobile && styles.wrapMobile]}>
      <Text
        style={[
          text.title,
          isDesktop && text.titleDesktop,
          isMobile && text.titleMobile,
          compactType && text.titleCompact,
          centered ? styles.titleCenter : styles.titleLeft,
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        typeof subtitle === 'string' ? (
          <Text
            style={[
              text.subtitle,
              isDesktop && text.subtitleDesktop,
              isMobile && text.subtitleMobile,
              compactType && text.subtitleCompact,
              centered ? styles.subtitleCenter : styles.subtitleLeft,
            ]}
          >
            {subtitle}
          </Text>
        ) : (
          <View style={centered ? styles.subtitleSlotCenter : styles.subtitleSlotLeft}>
            {subtitle}
          </View>
        )
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Platform.OS === 'web' ? 8 : 10,
  },
  wrapCompact: {
    marginBottom: Platform.OS === 'web' ? 6 : 8,
  },
  wrapMobile: {
    marginBottom: Platform.OS === 'web' ? 12 : 14,
  },
  centered: {
    alignItems: 'center',
  },
  titleLeft: {
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  titleCenter: {
    textAlign: 'center',
    alignSelf: 'center',
  },
  subtitleLeft: {
    textAlign: 'left',
    alignSelf: 'stretch',
    maxWidth: undefined,
  },
  subtitleCenter: {
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 360,
  },
  subtitleSlotLeft: {
    alignSelf: 'stretch',
    width: '100%',
  },
  subtitleSlotCenter: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
});
