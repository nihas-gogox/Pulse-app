import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnimationObject } from 'lottie-react-native';
import { GoogleBrandIcon } from '../components/GoogleBrandIcon';

import { HubPromoHeroLottie } from '@pulse/ui/components/hub/HubPromoLottie';
import { PulseMascotBanner } from '@pulse/ui/components/PulseMascotBanner';
import type { PulseMascotIllustrationId } from '@pulse/core/lib/pulseMascotIllustrations';

import { DecimalKeypad } from '@pulse/ui/components/mobile-input/DecimalKeypad';
import { applyKeypadPress, type KeypadKey } from '@pulse/ui/components/mobile-input/keypad';
import { KeypadDisplayValueWithCaret } from '@pulse/ui/components/party/keypad/KeypadDisplayValueWithCaret';
import { useMobileWebStepLayout } from '@pulse/core/lib/hooks/useMobileWebStepLayout';
import { useSignupKeypadInput } from '@pulse/domain/lib/onboarding/useSignupKeypadInput';

import { SignUpPulsePrimaryButton } from './SignUpPulsePrimaryButton';
import { SignUpPulseTitle } from './SignUpPulseTitle';
import Layout from '@pulse/core/constants/Layout';
import Theme from '@pulse/core/constants/Theme';

import { DESKTOP_BREAKPOINT } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PULSE_SIGNUP, PULSE_SIGNUP_RADIUS, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles, SIGNUP_ERROR_COLOR } from '@pulse/domain/features/auth/signup/signUpTypography';

/** Single horizontal inset for the docked keypad tray (edge-to-edge chrome). */
const KEYPAD_DOCK_INSET = Layout.screenPaddingHorizontal;

export interface SignUpPulseKeypadStepProps {
  title: string;
  subtitle?: string;
  value: string;
  onChange: (digits: string) => void;
  maxDigits: number;
  formatDisplay: (digits: string) => string;
  displayPrefix?: string;
  displayFlag?: string;
  emptyPlaceholder?: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLabel?: string;
  errorMessage?: string | null;
  hintMessage?: string | null;
  fieldLabel?: string;
  customDisplay?: ReactNode;
  footerAccessory?: ReactNode;
  showGoogle?: boolean;
  onGoogle?: () => void;
  googleLoading?: boolean;
  googleDisabled?: boolean;
  theme?: SignUpTheme;
  /** Center title, OTP row, and actions — used on verification step. */
  centeredLayout?: boolean;
  /** Optional hero animation above the title (driver / activation steps). */
  heroLottie?: AnimationObject;
  /**
   * Soft watermark-style Pulse mascot above the title (assets/illustrations).
   * Wins over `heroLottie` when both are set.
   */
  heroMascotId?: PulseMascotIllustrationId;
}

export const SignUpPulseKeypadStep = memo(function SignUpPulseKeypadStep({
  title,
  subtitle,
  value,
  onChange,
  maxDigits,
  formatDisplay,
  displayPrefix,
  displayFlag,
  emptyPlaceholder = '0',
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLabel = 'Continue',
  errorMessage,
  hintMessage,
  fieldLabel = 'Mobile Number',
  customDisplay,
  footerAccessory,
  showGoogle = false,
  onGoogle,
  googleLoading = false,
  googleDisabled = false,
  theme = PULSE_SIGNUP,
  centeredLayout = false,
  heroLottie,
  heroMascotId,
}: SignUpPulseKeypadStepProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);
  const useKeypad = useSignupKeypadInput();
  const layout = useMobileWebStepLayout();
  const inputRef = useRef<TextInput>(null);
  const blink = useRef(new Animated.Value(1)).current;
  const digits = value.replace(/\D/g, '').slice(0, maxDigits);
  const isEmpty = digits.length === 0;
  const displayText = isEmpty ? emptyPlaceholder : formatDisplay(digits);
  const showCursor = digits.length < maxDigits;
  const ready = digits.length >= maxDigits && !primaryDisabled && !primaryLoading;

  useEffect(() => {
    if (!useKeypad) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [useKeypad]);

  useEffect(() => {
    if (!useKeypad) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 520, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, useKeypad]);

  const handleDigitsChange = useCallback(
    (text: string) => {
      onChange(text.replace(/\D/g, '').slice(0, maxDigits));
    },
    [maxDigits, onChange],
  );

  const handleSubmitEditing = useCallback(() => {
    if (ready) onPrimary();
  }, [onPrimary, ready]);

  const handleKey = useCallback(
    (key: KeypadKey) => {
      const next = applyKeypadPress(digits, key, {
        maxIntDigits: maxDigits,
        maxDecimalPlaces: 0,
      });
      onChange(next);
    },
    [digits, maxDigits, onChange],
  );

  const phoneLead =
    displayFlag || displayPrefix ? (
      <>
        <View style={styles.phoneLead}>
          {displayFlag ? (
            <View style={styles.flagWrap}>
              <Text style={styles.flag}>{displayFlag}</Text>
            </View>
          ) : null}
          {displayPrefix ? <Text style={styles.prefix}>{displayPrefix}</Text> : null}
        </View>
        <View style={styles.phoneSep} />
      </>
    ) : null;

  const fieldInput = useKeypad ? (
    customDisplay ? (
      <View style={styles.customDisplay}>
        {customDisplay}
        {/* Invisible OTP-autofill hook: iOS never mounts the visible TextInput
            branch (custom keypad is forced there), so without this the SMS
            QuickType "Insert code" suggestion never appears. Keypad stays the
            visible/interactive UI; this only donates a oneTimeCode field. */}
        <TextInput
          value={digits}
          onChangeText={handleDigitsChange}
          onSubmitEditing={handleSubmitEditing}
          returnKeyType="go"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={maxDigits}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          style={styles.otpAutofillHidden}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    ) : (
      <View style={[styles.displayRow, errorMessage ? styles.displayError : null]}>
        {phoneLead}
        <KeypadDisplayValueWithCaret
          value={isEmpty ? '' : displayText}
          placeholder={displayText}
          showCaret={showCursor}
          caretPosition={isEmpty ? 'start' : 'end'}
          valueStyle={[
            styles.displayValue,
            isEmpty ? styles.placeholder : styles.displayValueTyped,
          ]}
          caret={
            <Animated.View
              style={[
                styles.cursor,
                isEmpty && styles.cursorLeading,
                { opacity: blink },
              ]}
            />
          }
        />
      </View>
    )
  ) : customDisplay ? (
    <View style={[styles.customDisplay, errorMessage ? styles.displayError : null]}>
      <View style={styles.otpWebWrap}>
        {customDisplay}
        <TextInput
          ref={inputRef}
          value={digits}
          onChangeText={handleDigitsChange}
          onSubmitEditing={handleSubmitEditing}
          returnKeyType="go"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={maxDigits}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          style={styles.otpWebOverlay}
          accessibilityLabel={fieldLabel}
        />
      </View>
    </View>
  ) : (
    <View style={[styles.displayRow, errorMessage ? styles.displayError : null]}>
      {phoneLead}
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleDigitsChange}
        onSubmitEditing={handleSubmitEditing}
        returnKeyType="go"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={maxDigits}
        placeholder={emptyPlaceholder}
        placeholderTextColor={theme.placeholder}
        autoComplete="tel"
        textContentType="telephoneNumber"
        selection={{ start: digits.length, end: digits.length }}
        style={styles.webInput}
        accessibilityLabel={fieldLabel}
      />
    </View>
  );

  const actionBlock = (
    <View style={styles.actionsWrap}>
      <SignUpPulsePrimaryButton
        label={primaryLabel}
        onPress={onPrimary}
        disabled={!ready}
        loading={primaryLoading}
        variant={ready ? 'ready' : 'solid'}
        style={styles.primaryBtn}
        theme={theme}
      />
      {showGoogle ? (
        <>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>
          <Pressable
            onPress={onGoogle}
            disabled={googleDisabled || googleLoading}
            style={({ pressed }) => [
              styles.googleBtn,
              (googleDisabled || googleLoading) && styles.googleBtnDisabled,
              pressed && styles.googleBtnPressed,
            ]}
          >
            <GoogleBrandIcon size={16} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );

  const formBody = (
    <View style={[styles.formBody, centeredLayout && styles.centeredStack]}>
      {heroMascotId ? (
        <View
          style={[
            styles.heroWrap,
            styles.heroWatermarkWrap,
            styles.heroWrapCentered,
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <PulseMascotBanner
            id={heroMascotId}
            maxHeight={isDesktop ? 120 : 104}
            style={styles.heroWatermark}
          />
        </View>
      ) : heroLottie ? (
        <View style={[styles.heroWrap, centeredLayout && styles.heroWrapCentered]}>
          <HubPromoHeroLottie
            source={heroLottie}
            width={isDesktop ? 112 : 96}
            height={isDesktop ? 112 : 96}
            renderScale={1.08}
          />
        </View>
      ) : null}
      <SignUpPulseTitle
        title={title}
        subtitle={subtitle}
        compact={useKeypad}
        centered={centeredLayout}
      />
      <Text style={[styles.fieldLabel, centeredLayout && styles.fieldLabelCenter]}>
        {fieldLabel}
      </Text>
      <View style={styles.fieldBlock}>
        {fieldInput}
        {errorMessage ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : hintMessage ? (
          <Text style={styles.hint}>{hintMessage}</Text>
        ) : null}
      </View>
      {!layout.useDockedFooter ? actionBlock : null}
    </View>
  );

  const contentScrollInner = [
    styles.contentScrollInner,
    isDesktop && styles.contentScrollInnerDesktop,
    centeredLayout && styles.contentScrollInnerCentered,
    layout.useDockedFooter && { paddingBottom: layout.scrollPaddingBottom },
    !layout.useDockedFooter && { paddingBottom: 24 },
  ];

  return (
    <View style={[styles.root, layout.rootStyle, !useKeypad && styles.rootWeb]}>
      <View style={[styles.main, !useKeypad && styles.mainWeb]}>
        {useKeypad ? (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollInnerKeypad}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {formBody}
            {actionBlock}
          </ScrollView>
        ) : (
          <ScrollView
            style={[
              styles.contentScroll,
              layout.useDockedFooter && { marginBottom: layout.scrollClearance },
            ]}
            contentContainerStyle={contentScrollInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formBody}
            {footerAccessory ? (
              <View style={centeredLayout ? styles.footerAccessoryCentered : undefined}>
                {footerAccessory}
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {!useKeypad && layout.useDockedFooter ? (
        <View
          style={[
            styles.webFooterDock,
            layout.footerStyle,
            { borderTopColor: theme.border, backgroundColor: theme.bg },
          ]}
        >
          {actionBlock}
        </View>
      ) : null}

      {useKeypad && footerAccessory ? (
        <View style={styles.accessoryDock}>{footerAccessory}</View>
      ) : null}

      {useKeypad ? (
        <View
          style={[
            styles.keypadDock,
            {
              paddingBottom: Math.max(
                insets.bottom,
                Platform.OS === 'web' ? 8 : 10,
              ),
            },
          ]}
        >
          <DecimalKeypad
            onKey={handleKey}
            showDecimal={false}
            variant="pay"
            layout="phone"
            hapticsEnabled={false}
          />
        </View>
      ) : null}
    </View>
  );
});

function createStyles(theme: SignUpTheme, isDesktop: boolean) {
  const text = createPulseSignUpTextStyles(theme);
  const mobile = !isDesktop;

  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
    },
    main: {
      flex: 1,
      minHeight: 0,
    },
    rootWeb: {
      flex: 1,
      minHeight: 0,
    },
    mainWeb: {
      flex: 1,
      minHeight: 0,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    contentScroll: {
      flex: 1,
    },
    contentScrollInner: {
      paddingHorizontal: 20,
      paddingTop: 8,
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center',
    },
    contentScrollInnerKeypad: {
      paddingHorizontal: mobile ? 24 : 20,
      paddingTop: mobile ? 8 : 4,
      paddingBottom: 4,
      flexGrow: 1,
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center',
    },
    contentScrollInnerDesktop: {
      paddingHorizontal: 0,
      paddingTop: 10,
      width: '100%',
      alignSelf: 'stretch',
      flexGrow: 1,
    },
    contentScrollInnerCentered: {
      alignItems: 'center',
    },
    centeredStack: {
      width: '100%',
      maxWidth: mobile ? 420 : 360,
      alignSelf: 'center',
      alignItems: 'stretch',
    },
    formBody: {
      width: '100%',
      maxWidth: mobile ? 420 : 360,
      alignSelf: 'center',
      minWidth: 0,
    },
    heroWrap: {
      alignItems: 'flex-start',
      marginBottom: mobile ? 12 : 14,
    },
    heroWatermarkWrap: {
      width: '100%',
      maxWidth: mobile ? 280 : 300,
    },
    heroWatermark: {
      opacity: 0.42,
    },
    heroWrapCentered: {
      alignItems: 'center',
      alignSelf: 'center',
    },
    fieldLabelCenter: {
      textAlign: 'center',
    },
    fieldLabel: {
      ...(mobile ? text.fieldLabelMobile : text.fieldLabel),
      marginBottom: mobile ? 10 : 8,
    },
    fieldBlock: {
      width: '100%',
      alignSelf: 'stretch',
      marginBottom: 12,
    },
    footerAccessoryCentered: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      alignItems: 'center',
    },
    customDisplay: {
      width: '100%',
      marginBottom: 0,
      overflow: 'hidden',
    },
    displayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: mobile ? 16 : 14,
      minHeight: mobile ? 52 : 44,
      backgroundColor: theme.bg,
      borderRadius: PULSE_SIGNUP_RADIUS.input,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 0,
      ...Platform.select({
        web: { boxSizing: 'border-box' } as object,
      }),
    },
    displayError: {
      borderColor: SIGNUP_ERROR_COLOR,
      backgroundColor: '#fef2f2',
    },
    phoneLead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    flagWrap: {
      width: mobile ? 24 : 20,
      height: mobile ? 24 : 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flag: {
      fontSize: mobile ? 18 : 14,
      lineHeight: mobile ? 22 : 18,
      ...Platform.select({
        android: { includeFontPadding: false, textAlignVertical: 'center' },
      }),
    },
    prefix: {
      ...(mobile ? text.displayPrefixMobile : text.displayPrefix),
      color: theme.muted,
      letterSpacing: 0,
      ...Platform.select({
        android: { includeFontPadding: false, textAlignVertical: 'center' },
        ios: { fontVariant: ['tabular-nums'] as const },
        default: { fontVariant: ['tabular-nums'] as const },
      }),
    },
    phoneSep: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: 12,
      marginHorizontal: 10,
      backgroundColor: theme.border,
      flexShrink: 0,
    },
    digitArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      minHeight: 24,
    },
    displayValue: {
      ...(mobile ? text.displayMobile : text.display),
      ...Platform.select({
        android: { includeFontPadding: false, textAlignVertical: 'center' },
        ios: { fontVariant: ['tabular-nums'] as const },
        default: { fontVariant: ['tabular-nums'] as const },
      }),
    },
    displayValueTyped: {
      flexShrink: 1,
    },
    placeholder: {
      flex: 1,
      color: theme.placeholder,
      fontWeight: '400',
      letterSpacing: 1,
    },
    cursor: {
      width: 2,
      height: 18,
      borderRadius: 1,
      backgroundColor: theme.primaryDark,
      marginLeft: 2,
      flexShrink: 0,
      alignSelf: 'center',
    },
    cursorLeading: {
      marginLeft: 0,
      marginRight: 2,
    },
    webInput: {
      flex: 1,
      ...(mobile ? text.displayMobile : text.display),
      color: theme.text,
      minWidth: 0,
      paddingVertical: 0,
      margin: 0,
      ...Platform.select({
        android: { includeFontPadding: false, textAlignVertical: 'center' },
        ios: { fontVariant: ['tabular-nums'] as const },
        default: { fontVariant: ['tabular-nums'] as const, outlineStyle: 'none' } as object,
      }),
    },
    otpWebWrap: {
      position: 'relative',
      width: '100%',
    },
    otpWebOverlay: {
      // Invisible OTP capture field: holds focus for the physical keyboard while
      // the visible boxes show the digits. Fully transparent so its own value
      // never paints over the boxes (opacity:0 inputs stay focusable on web).
      ...StyleSheet.absoluteFillObject,
      opacity: 0,
      fontSize: 1,
      color: 'transparent',
      borderWidth: 0,
      backgroundColor: 'transparent',
      ...Platform.select({
        web: {
          caretColor: 'transparent',
          WebkitTextFillColor: 'transparent',
          outlineStyle: 'none',
        } as object,
        default: {},
      }),
    },
    otpAutofillHidden: {
      // Same invisible-autofill-hook idea as otpWebOverlay, but self-positioned
      // (absolute top-left, 1x1) instead of absoluteFillObject — the custom
      // keypad's customDisplay container isn't position:relative and clips
      // overflow, so a full-fill overlay would be inert/clipped here.
      position: 'absolute',
      top: 0,
      left: 0,
      width: 1,
      height: 1,
      opacity: 0,
      fontSize: 1,
      color: 'transparent',
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    error: {
      ...(mobile ? text.errorMobile : text.error),
      marginTop: 6,
      marginBottom: 0,
      paddingLeft: 2,
      alignSelf: 'stretch',
    },
    hint: {
      ...(mobile ? text.hintMobile : text.hint),
      marginTop: 6,
      marginBottom: 0,
      paddingLeft: 2,
      alignSelf: 'stretch',
    },
    primaryBtn: {
      marginBottom: 0,
      alignSelf: 'stretch',
      maxWidth: '100%',
    },
    actionsWrap: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
      marginTop: 4,
      gap: 0,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 12,
      gap: 12,
    },
    orLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    orText: {
      ...(mobile ? text.orMobile : text.or),
    },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      width: '100%',
      maxWidth: '100%',
      gap: 8,
      paddingVertical: mobile ? 14 : 10,
      borderRadius: PULSE_SIGNUP_RADIUS.button,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      marginBottom: 4,
      minHeight: mobile ? 48 : 40,
      ...Platform.select({
        web: { boxSizing: 'border-box' } as object,
      }),
    },
    googleBtnDisabled: {
      opacity: 0.5,
    },
    googleBtnPressed: {
      backgroundColor: theme.surface,
    },
    googleText: mobile ? text.googleMobile : text.google,
    accessoryDock: {
      flexShrink: 0,
      alignSelf: 'stretch',
      width: '100%',
      paddingHorizontal: KEYPAD_DOCK_INSET,
      paddingTop: 4,
      paddingBottom: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    webFooterDock: {
      paddingHorizontal: 24,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    /** Full-bleed tray — pay keypad owns horizontal inset via PAY_KEYPAD_*. */
    keypadDock: {
      flexShrink: 0,
      alignSelf: 'stretch',
      width: '100%',
      backgroundColor: Theme.surfaceGray,
      borderTopWidth: 0,
      borderTopLeftRadius: PULSE_SIGNUP_RADIUS.keypadTray,
      borderTopRightRadius: PULSE_SIGNUP_RADIUS.keypadTray,
      paddingTop: 0,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        android: { elevation: 6 },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
      }),
    },
  });
}
