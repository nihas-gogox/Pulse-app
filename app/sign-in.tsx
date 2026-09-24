import Layout from '@/constants/Layout';
import {
    PULSE_PILL_BUTTON_BORDER_WIDTH,
    PULSE_PILL_BUTTON_RADIUS,
    pulsePillButtonLabelDefault,
} from '@/constants/PulsePillButtonChrome';
import Theme from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useIsOnline } from '@/contexts/NetworkContext';
import { GoogleBrandIcon } from '@/features/auth/components/GoogleBrandIcon';
import { SignInBrandPanel } from '@/features/auth/components/SignInBrandPanel';
import { useSuiteAuthContext } from '@/features/auth/hooks/useSuiteAuthContext';
import { SignUpPulseField } from '@/features/auth/signup/SignUpPulseField';
import {
  DESKTOP_SIGNUP_SPLIT_FLOW_MAX,
  DESKTOP_SIGNUP_SPLIT_PAD,
  DESKTOP_SIGNUP_SPLIT_FLOW_PAD_Y,
} from '@/features/auth/signup/signUpConstants';
import { signUpMobileContentInner } from '@/features/auth/signup/signUpMobile.styles';
import { PULSE_SIGNUP, PULSE_SIGNUP_RADIUS } from '@/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles, PULSE_SIGNUP_TYPO } from '@/features/auth/signup/signUpTypography';
import { SIGN_IN_BRAND } from '@/lib/auth/signInContent';
import { markFreshSignInLanding, isPostAuthShellLanding } from '@/lib/indexBootRedirect.util';
import { navigateAfterSuiteAuth, normalizeSuiteReturnTo } from '@/lib/suite/suiteAuth';
import { suiteSignInCopy } from '@/lib/suite/suiteAuthContent';
import { validateEmailRequired } from '@/lib/emailValidation';
import { getKeepSignedIn } from '@/lib/keepSignedInPreference';
import { ROUTES } from '@/lib/routes';
import { useIsDesktopWebInput } from '@/lib/useIsDesktopWebInput';
import { containsNullByte, validatePasswordForSignIn } from '@/lib/validation';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRootNavigationState, useRouter, type Href } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getEmailFromParams(params: { email?: string | string[] }): string {
  const e = params.email;
  if (typeof e === 'string') return e;
  if (Array.isArray(e) && e[0]) return e[0];
  return '';
}

function getOAuthErrorFromParams(params: { oauth_error?: string | string[] }): string {
  const e = params.oauth_error;
  const raw = typeof e === 'string' ? e : Array.isArray(e) && e[0] ? e[0] : '';
  if (!raw) return '';
  // OAuth error_description can be long or odd-shaped; keep UI safe and bounded.
  const cleaned = raw.replace(/\0/g, '').trim().slice(0, 400);
  return cleaned;
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const rootNavReady = Boolean(rootNavigationState?.key);
  const params = useLocalSearchParams<{
    email?: string | string[];
    oauth_error?: string | string[];
    password_reset?: string | string[];
    returnTo?: string | string[];
  }>();
  const { productId, returnTo } = useSuiteAuthContext();
  const signInCopy = suiteSignInCopy(productId);
  const isOnline = useIsOnline();
  const { user, signIn, signInWithGoogle, restoreError, clearRestoreError } = useAuth();
  const isDesktop = useIsDesktopWebInput();

  const [email, setEmail] = useState(() => getEmailFromParams(params));
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [keepSignedIn, setKeepSignedInState] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [waitingForAuthState, setWaitingForAuthState] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [passwordResetBanner, setPasswordResetBanner] = useState(false);
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formFade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formSlide, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [formFade, formSlide]);

  useEffect(() => {
    let mounted = true;
    getKeepSignedIn().then((keep) => {
      if (mounted) setKeepSignedInState(keep);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !rootNavReady) return;
    const target = normalizeSuiteReturnTo(returnTo);
    const shellLanding = isPostAuthShellLanding(target);
    if (shellLanding) markFreshSignInLanding();
    navigateAfterSuiteAuth(shellLanding ? '/' : returnTo, (href) => {
      try {
        router.replace(href as Href);
      } catch {
        // Slot not mounted yet — retry when rootNavReady / user deps change.
      }
    });
  }, [user, router, returnTo, rootNavReady]);

  useEffect(() => {
    const next = getEmailFromParams(params);
    if (next) setEmail(next);
  }, [params]);

  useEffect(() => {
    const oauthError = getOAuthErrorFromParams(params);
    if (oauthError) setSignInError(oauthError);
  }, [params]);

  useEffect(() => {
    const v = params.password_reset;
    const flag = typeof v === 'string' ? v : Array.isArray(v) && v[0] ? v[0] : '';
    setPasswordResetBanner(flag === '1');
  }, [params.password_reset]);

  const handleSignIn = async () => {
    if (loading) return;
    setSignInError(null);
    clearRestoreError();
    setWaitingForAuthState(false);
    if (!isOnline) {
      setSignInError('Connect to the internet to sign in.');
      return;
    }
    const emailErr = validateEmailRequired(email);
    if (emailErr) {
      setSignInError(emailErr);
      return;
    }
    const trimmedEmail = email.trim();
    if (containsNullByte(trimmedEmail) || containsNullByte(password)) {
      setSignInError('Input contains invalid characters.');
      return;
    }
    const pwdErr = validatePasswordForSignIn(password);
    if (pwdErr) {
      setSignInError(pwdErr);
      return;
    }

    try {
      setLoading(true);
      const { error } = await signIn(trimmedEmail, password, keepSignedIn);
      if (error) {
        setSignInError(error.message);
        return;
      }
      setWaitingForAuthState(true);
    } catch {
      const msg = 'Sign in failed. Please try again.';
      setSignInError(msg);
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setSignInError(null);
    clearRestoreError();
    setWaitingForAuthState(false);
    if (!isOnline) {
      setSignInError("Connect to the internet to sign in.");
      return;
    }
    try {
      setGoogleLoading(true);
      const { error } = await signInWithGoogle(keepSignedIn);
      if (error) {
        setSignInError(error.message);
        return;
      }
      setWaitingForAuthState(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google sign in failed.";
      setSignInError(msg);
      Alert.alert("Sign in failed", msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const formDisabled = loading || waitingForAuthState || !isOnline;

  const renderSignInForm = () => (
  <View style={styles.formUnit}>
    <View style={[styles.formHeader, isDesktop && styles.formHeaderDesktop]}>
      <Text style={[styles.formTitle, isDesktop && styles.formTitleDesktop]}>
        {signInCopy.formTitle}
      </Text>
      <Text style={styles.formSubtitle}>{signInCopy.formSubtitle}</Text>
    </View>

    <View style={styles.formFields}>
      <SignUpPulseField
        label="Email"
        theme={PULSE_SIGNUP}
        comfortable={!isDesktop}
        value={email}
        onChangeText={(t) => {
          setSignInError(null);
          setPasswordResetBanner(false);
          setEmail(t);
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        maxLength={255}
        editable={!formDisabled}
      />

      <SignUpPulseField
        label="Password"
        theme={PULSE_SIGNUP}
        comfortable={!isDesktop}
        value={password}
        onChangeText={(t) => {
          setSignInError(null);
          setPassword(t);
        }}
        placeholder="Your password"
        secureTextEntry={!showPass}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="password"
        maxLength={128}
        editable={!formDisabled}
        trailing={
          <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
            {showPass ? (
              <EyeOff size={18} color={PULSE_SIGNUP.muted} />
            ) : (
              <Eye size={18} color={PULSE_SIGNUP.muted} />
            )}
          </Pressable>
        }
      />

      <Pressable
        onPress={() =>
          router.push(
            `${ROUTES.FORGOT_PASSWORD}?email=${encodeURIComponent(email.trim())}` as Href,
          )
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.forgotRow}
      >
        <Text style={styles.forgotText}>{signInCopy.forgotPassword}</Text>
      </Pressable>

      {passwordResetBanner ? (
        <Text style={styles.successBanner}>Password updated. Sign in with your new password.</Text>
      ) : null}
      {signInError || restoreError ? (
        <Text style={styles.errorText}>
          {signInError ?? restoreError?.message ?? 'Could not restore your session. Sign in again.'}
        </Text>
      ) : null}
    </View>

    <View style={styles.formActions}>
      <Pressable
        testID="signin-submit-btn"
        onPress={handleSignIn}
        disabled={formDisabled}
        style={({ pressed }) => [
          styles.signInBtn,
          formDisabled && styles.signInBtnDisabled,
          pressed && !formDisabled && styles.signInBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={signInCopy.primaryCta}
        accessibilityState={{ disabled: formDisabled, busy: loading || waitingForAuthState }}
      >
        {loading || waitingForAuthState ? (
          <ActivityIndicator color={Theme.buttonPrimaryText} size="small" />
        ) : (
          <Text style={styles.signInBtnText}>{signInCopy.primaryCta}</Text>
        )}
      </Pressable>

      <View style={styles.sectionDivider} />

      <Pressable
        onPress={handleGoogleSignIn}
        disabled={googleLoading || formDisabled}
        style={({ pressed }) => [
          styles.googleBtn,
          (googleLoading || formDisabled) && styles.googleBtnDisabled,
          pressed && !googleLoading && !formDisabled && styles.googleBtnPressed,
        ]}
      >
        {googleLoading ? (
          <Text style={styles.googleBtnText}>Signing in…</Text>
        ) : (
          <>
            <GoogleBrandIcon size={16} />
            <Text style={styles.googleBtnText}>{signInCopy.googleCta}</Text>
          </>
        )}
      </Pressable>

      <View style={styles.sectionDivider} />

      <View style={styles.footerLinksRow}>
        <Pressable
          onPress={() => router.push(ROUTES.ONBOARDING.HUB as Href)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.footerLinkText}>{signInCopy.footerLink}</Text>
        </Pressable>
        <Text style={styles.footerLinkDot}>·</Text>
        <Pressable
          onPress={() => router.push(ROUTES.DRIVER_SIGN_IN as Href)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.footerLinkText}>Sign in as a driver</Text>
        </Pressable>
      </View>
    </View>
  </View>
  );

  const renderAnimatedForm = () => (
    <Animated.View
      style={{
        opacity: formFade,
        transform: [{ translateY: formSlide }],
        width: '100%',
      }}
    >
      {renderSignInForm()}
    </Animated.View>
  );

  const renderSignIn = () => (
    <View style={[styles.panelShell, isDesktop && styles.panelShellDesktop]}>
      {isDesktop ? (
        <>
          <SignInBrandPanel productId={productId} />
          <View style={styles.panelDivider} />
        </>
      ) : null}
      <View style={[styles.rightPanel, isDesktop && styles.rightPanelDesktop]}>
        {isDesktop ? (
          <View style={styles.formColumn}>{renderAnimatedForm()}</View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderAnimatedForm()}
          </ScrollView>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        isDesktop ? styles.containerDesktop : null,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 20 : 0}
    >
      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No internet connection.</Text>
        </View>
      ) : null}

      {renderSignIn()}

      <Pressable
        onPress={() => router.replace(ROUTES.ONBOARDING.HUB)}
        style={[styles.backFloating, { bottom: insets.bottom + 12 }]}
      >
        <FontAwesome name="chevron-left" size={14} color={PULSE_SIGNUP.muted} />
        <Text style={styles.backFloatingText}>Back</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const pulseText = createPulseSignUpTextStyles(PULSE_SIGNUP);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PULSE_SIGNUP.bg,
    paddingHorizontal: Layout.screenPaddingHorizontal,
  },
  containerDesktop: {
    backgroundColor: Theme.screenBackground,
    paddingHorizontal: 0,
  },
  offlineBanner: {
    backgroundColor: Theme.negativeMuted,
    borderColor: Theme.negative,
    borderWidth: 1,
    borderRadius: PULSE_SIGNUP_RADIUS.pill,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: Layout.screenPaddingHorizontal,
  },
  offlineText: {
    textAlign: 'center',
    color: Theme.negative,
    fontSize: 12,
    fontWeight: '600',
  },
  panelShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: PULSE_SIGNUP.bg,
  },
  panelShellDesktop: {
    backgroundColor: Theme.screenBackground,
  },
  panelDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(77, 54, 54, 0.1)',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: PULSE_SIGNUP.bg,
  },
  rightPanelDesktop: {
    flex: 1,
    minWidth: 0,
    maxWidth: '50%',
    paddingHorizontal: DESKTOP_SIGNUP_SPLIT_PAD,
    paddingVertical: DESKTOP_SIGNUP_SPLIT_FLOW_PAD_Y,
    backgroundColor: Theme.screenBackground,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  formColumn: {
    width: '100%',
    maxWidth: DESKTOP_SIGNUP_SPLIT_FLOW_MAX,
    minWidth: 0,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    ...signUpMobileContentInner,
  },
  formUnit: {
    width: '100%',
    maxWidth: DESKTOP_SIGNUP_SPLIT_FLOW_MAX,
    alignSelf: 'center',
  },
  formHeader: {
    marginBottom: 20,
  },
  formHeaderDesktop: {
    marginBottom: 14,
  },
  formTitle: {
    ...PULSE_SIGNUP_TYPO.title,
    color: SIGN_IN_BRAND.ink,
  },
  formTitleDesktop: {
    ...PULSE_SIGNUP_TYPO.titleDesktop,
    color: SIGN_IN_BRAND.ink,
  },
  formSubtitle: {
    ...PULSE_SIGNUP_TYPO.subtitle,
    color: PULSE_SIGNUP.muted,
    marginTop: 4,
  },
  formFields: {
    width: '100%',
  },
  formActions: {
    width: '100%',
    marginTop: 12,
  },
  errorText: {
    ...pulseText.error,
    marginTop: -4,
    marginBottom: 12,
  },
  successBanner: {
    ...pulseText.captionMedium,
    color: Theme.positive,
    marginTop: -4,
    marginBottom: 12,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 0,
  },
  forgotText: {
    ...pulseText.captionMedium,
    color: SIGN_IN_BRAND.ink,
    fontWeight: '600',
  },
  signInBtn: {
    minHeight: 40,
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
    borderColor: Theme.buttonPrimaryBorder,
    backgroundColor: Theme.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxSizing: 'border-box',
          cursor: 'pointer',
          transitionProperty: 'background-color, opacity',
          transitionDuration: '160ms',
        } as object)
      : null),
  },
  signInBtnDisabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as object) : null),
  },
  signInBtnPressed: {
    backgroundColor: Theme.buttonPrimaryPressed,
    ...(Platform.OS === 'web' ? ({ opacity: 0.92 } as object) : null),
  },
  signInBtnText: {
    ...pulsePillButtonLabelDefault,
    color: Theme.buttonPrimaryText,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PULSE_SIGNUP.border,
    marginVertical: 14,
    alignSelf: 'stretch',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    gap: 8,
    minHeight: 40,
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    borderWidth: 1,
    borderColor: PULSE_SIGNUP.border,
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web'
      ? ({
          boxSizing: 'border-box',
          transitionProperty: 'background-color, border-color',
          transitionDuration: '160ms',
          transitionTimingFunction: 'ease-out',
        } as object)
      : null),
  },
  googleBtnDisabled: {
    opacity: 0.5,
  },
  googleBtnPressed: {
    backgroundColor: PULSE_SIGNUP.surface,
    borderColor: PULSE_SIGNUP.borderFocus,
    ...(Platform.OS === 'web' ? ({ transform: [{ scale: 0.99 }] } as object) : null),
  },
  googleBtnText: {
    ...pulseText.google,
    color: PULSE_SIGNUP.text,
  },
  backFloating: {
    position: 'absolute',
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backFloatingText: pulseText.back,
  footerLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLinkText: {
    ...pulseText.linkSmall,
    color: SIGN_IN_BRAND.ink,
    fontWeight: '600',
  },
  footerLinkDot: {
    ...pulseText.linkSmall,
    color: PULSE_SIGNUP.muted,
  },
});
