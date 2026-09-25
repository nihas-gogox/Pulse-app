import { memo, useEffect, useRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { PulseBrandMark } from '@pulse/ui/components/brand/PulseBrandMark';
import {
  PULSE_CORE_BRAND_WORD,
  PULSE_PILOT_BRAND_WORD,
} from '@pulse/core/lib/brand/pulseBrandMark.tokens';
import { useKeyboardVisible } from '@pulse/core/lib/hooks/useKeyboardVisible';
import { WEB_APP_VIEWPORT_STYLE } from '@pulse/core/lib/webViewportHeight';

import { PulseActivationDesktopSplit } from './components/PulseActivationDesktopSplit';
import { DRIVER_SIGNUP } from '@pulse/domain/features/auth/signup/signUpDriverTheme';
import { DESKTOP_SIGNUP_SPLIT_FLOW_MAX } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles, PULSE_SIGNUP_TYPO } from '@pulse/domain/features/auth/signup/signUpTypography';

/** Min width per progress segment when the rail scrolls horizontally. */
const PROGRESS_ITEM_MIN_WIDTH = 52;

export type SignUpShellTheme = SignUpTheme;

export interface SignUpPulseShellProps {
  backLabel?: string;
  onBack: () => void;
  stepLabels: readonly string[];
  currentStepIndex: number;
  hideProgress?: boolean;
  isDesktop?: boolean;
  theme?: SignUpShellTheme;
  /** Override header wordmark (suite products). */
  brandWord?: string;
  children: ReactNode;
  /** Left marketing panel copy (desktop split layout). */
  marketingTag?: string;
  marketingTitle?: string;
  marketingOutcomeLines?: readonly string[];
  /**
   * When true, body does not add bottom safe-area padding — child docks
   * (e.g. numeric keypad) own the home-indicator inset themselves.
   */
  edgeToEdgeBody?: boolean;
}

export const SignUpPulseShell = memo(function SignUpPulseShell({
  backLabel = 'Back',
  onBack,
  stepLabels,
  currentStepIndex,
  hideProgress = false,
  isDesktop = false,
  theme = PULSE_SIGNUP,
  brandWord: brandWordProp,
  children,
  marketingTag,
  marketingTitle,
  marketingOutcomeLines,
  edgeToEdgeBody = false,
}: SignUpPulseShellProps) {
  const insets = useSafeAreaInsets();
  const stepIndex = Math.min(Math.max(currentStepIndex, 0), stepLabels.length - 1);
  const styles = createStyles(theme, isDesktop);
  const useScrollableProgress = stepLabels.length > 5;
  const progressScrollRef = useRef<ScrollView>(null);
  const { keyboardVisible } = useKeyboardVisible();
  const showProgress = !hideProgress && stepLabels.length > 0 && !keyboardVisible;

  useEffect(() => {
    if (!useScrollableProgress) return;
    const x = Math.max(0, stepIndex * PROGRESS_ITEM_MIN_WIDTH - 72);
    progressScrollRef.current?.scrollTo({ x, animated: true });
  }, [stepIndex, useScrollableProgress]);

  const brandWord =
    brandWordProp ??
    (theme === DRIVER_SIGNUP ? PULSE_PILOT_BRAND_WORD : PULSE_CORE_BRAND_WORD);

  const device = (
    <View
      style={[
        styles.device,
        isDesktop && {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        !isDesktop && { paddingTop: insets.top },
      ]}
    >
      <View style={[styles.flowColumn, isDesktop && styles.flowColumnDesktop]}>
        <View style={styles.header}>
        {backLabel ? (
          <Pressable
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            <ChevronLeft size={20} color={theme.muted} strokeWidth={2.5} />
            <Text style={[styles.backText, !isDesktop && styles.backTextMobile]}>{backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <PulseBrandMark
          word={brandWord}
          size={isDesktop ? 'sm' : 'smMobile'}
          style={styles.brand}
        />
        <View style={styles.headerSpacer} />
      </View>

      <View
        style={[
          styles.body,
          {
            paddingBottom:
              edgeToEdgeBody || !hideProgress ? 0 : Math.max(insets.bottom, 8),
          },
        ]}
      >
        {children}
      </View>

      {showProgress ? (
        <View
          style={[
            styles.progressFooter,
            { paddingBottom: Math.max(insets.bottom, isDesktop ? 20 : 12) },
          ]}
        >
          {useScrollableProgress ? (
            <ScrollView
              ref={progressScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.progressScrollContent}
            >
              {stepLabels.map((label, i) => {
                const active = i <= stepIndex;
                return (
                  <View
                    key={`${label}-${i}`}
                    style={[styles.progressItem, styles.progressItemScroll]}
                  >
                    <View style={[styles.progressBar, active && styles.progressBarActive]} />
                    <Text
                      style={[styles.progressLabel, active && styles.progressLabelActive]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.progressRow}>
              {stepLabels.map((label, i) => {
                const active = i <= stepIndex;
                return (
                  <View key={`${label}-${i}`} style={styles.progressItem}>
                    <View style={[styles.progressBar, active && styles.progressBarActive]} />
                    <Text
                      style={[styles.progressLabel, active && styles.progressLabelActive]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <View
        style={[
          styles.desktopSplitRoot,
          Platform.OS === 'web' ? (WEB_APP_VIEWPORT_STYLE as object) : null,
        ]}
      >
        <PulseActivationDesktopSplit
          brandWord={brandWord}
          marketingTag={marketingTag}
          marketingTitle={marketingTitle}
          outcomeLines={marketingOutcomeLines}
        >
          {device}
        </PulseActivationDesktopSplit>
      </View>
    );
  }

  const shellRootStyle: ViewStyle | ViewStyle[] =
    Platform.OS === 'web' ? styles.webFill : styles.nativeFill;

  return (
    <View style={shellRootStyle}>
      <View style={Platform.OS === 'web' ? styles.webCenterWrap : styles.nativeFill}>
        {device}
      </View>
    </View>
  );
});

function createStyles(theme: SignUpShellTheme, isDesktop: boolean) {
  const text = createPulseSignUpTextStyles(theme);

  return StyleSheet.create({
    desktopSplitRoot: {
      flex: 1,
      minHeight: 0,
    },
    device: {
      flex: 1,
      width: '100%',
      backgroundColor: theme.bg,
      overflow: 'hidden',
      minHeight: 0,
    },
    flowColumn: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    flowColumnDesktop: {
      flex: 1,
      width: '100%',
      maxWidth: DESKTOP_SIGNUP_SPLIT_FLOW_MAX,
      alignSelf: 'center',
      minHeight: 0,
    },
    webFill: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      backgroundColor: theme.canvas,
      minHeight: 0,
    },
    webCenterWrap: {
      flex: 1,
      width: '100%',
      maxWidth: 480,
      minHeight: 0,
    },
    nativeFill: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isDesktop ? 0 : 20,
      paddingTop: isDesktop ? 16 : 8,
      paddingBottom: isDesktop ? 12 : 8,
      backgroundColor: theme.bg,
      borderBottomWidth: isDesktop ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: theme.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      minWidth: 64,
      paddingVertical: 8,
      marginLeft: -8,
    },
    backText: text.back,
    backTextMobile: text.backMobile,
    brand: {
      flexShrink: 0,
    },
    headerSpacer: {
      minWidth: 64,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    progressFooter: {
      paddingTop: isDesktop ? 12 : 10,
      paddingHorizontal: isDesktop ? 0 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 4,
    },
    progressScrollContent: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      paddingHorizontal: 4,
    },
    progressItem: {
      flex: 1,
      alignItems: 'center',
      gap: isDesktop ? 8 : 6,
      minWidth: 0,
      paddingHorizontal: 2,
    },
    progressItemScroll: {
      flex: 0,
      flexGrow: 0,
      flexShrink: 0,
      minWidth: PROGRESS_ITEM_MIN_WIDTH,
      maxWidth: 72,
      paddingHorizontal: 4,
    },
    progressBar: {
      width: '100%',
      height: isDesktop ? 3 : 4,
      borderRadius: 999,
      backgroundColor: '#e5e7eb',
    },
    progressBarActive: {
      backgroundColor: theme.primaryDark,
    },
    progressLabel: {
      ...text.progressLabel,
      ...(isDesktop ? {} : PULSE_SIGNUP_TYPO.progressLabelMobile),
      textAlign: 'center',
      width: '100%',
    },
    progressLabelActive: text.progressLabelActive,
  });
}

export { DRIVER_SIGNUP, PULSE_SIGNUP };
