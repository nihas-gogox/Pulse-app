/**
 * Driver sign-in: phone → OTP → signed in directly. No password step, ever.
 *
 * OTP here is UI-only for now (TEMPORARY / INSECURE — see
 * signInDriverByPhoneUnverified in features/auth/services/auth.service.ts):
 * Supabase's SMS provider isn't configured ("Unsupported phone provider"), so
 * there is no way yet to prove phone possession. Anyone who knows a driver's
 * phone number can currently sign in as that driver through this screen.
 * Real, verified phone OTP (sendDriverPhoneOtp/verifyDriverPhoneOtp, backed by
 * the link-driver-phone Edge Function) is already built — swap handleSendOtp/
 * handleVerifyOtp to call those instead once the SMS provider is enabled, then
 * delete signInDriverByPhoneUnverified and supabase/functions/driver-phone-signin-unverified/.
 */
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useIsOnline } from '@pulse/core/contexts/NetworkContext';
import { checkExistingUserByPhone, signInDriverByPhoneUnverified } from '@pulse/domain/features/auth/services/auth.service';
import { SignUpMobileShell } from '@pulse/features/features/auth/signup/SignUpMobileShell';
import { SignUpOtpBoxes } from '@pulse/features/features/auth/signup/SignUpOtpBoxes';
import { SignUpPulseKeypadStep } from '@pulse/features/features/auth/signup/SignUpPulseKeypadStep';
import { formatSignupPhoneDisplay } from '@pulse/domain/features/auth/signup/signUpKeypad.util';
import { DRIVER_SIGNUP } from '@pulse/domain/features/auth/signup/signUpDriverTheme';
import { DRIVER_SIGNUP_HERO_MASCOT } from '../../features/auth/signup/signUpDriverLottieAssets';
import { createPulseSignUpTextStyles } from '@pulse/domain/features/auth/signup/signUpTypography';
import { showAppAlert } from '@pulse/core/lib/appAlert';
import { formatMobileNumber } from '@pulse/core/lib/format';
import { isPhoneValid, validatePhone } from '@pulse/core/lib/phoneValidation';
import { ROUTES } from '@pulse/core/lib/routes';
import { useSafeBack } from '@pulse/core/lib/useSafeBack';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const INDIA_DIAL_CODE = '91';
const OTP_LENGTH = 4;

const STEP_CONTENT = [
  {
    title: 'Sign in as a driver',
    subtitle: 'Enter the Indian mobile number linked to your account.',
  },
  {
    title: 'Verify your number',
    subtitle: 'Enter the 4-digit code we sent to your number.',
  },
] as const;

/** Strip spaces/leading + then digits only — same normalization driver-signup uses. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const withPlus = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  return withPlus.replace(/\D/g, '');
}

function getFullPhoneIndia(national: string): string {
  const digits = normalizePhone(national);
  return digits.length === 10 ? `+${INDIA_DIAL_CODE}${digits}` : '';
}

function isPhoneStepValid(national: string): boolean {
  const digits = normalizePhone(national);
  return digits.length === 10 && isPhoneValid(digits);
}

function getPhoneInlineError(national: string): string | null {
  const t = national.trim();
  if (t.length === 0) return null;
  const digits = normalizePhone(national);
  if (digits.length !== 10) {
    return digits.length > 10 ? 'Enter at most 10 digits.' : 'Enter a 10-digit number.';
  }
  return validatePhone(digits);
}

const driverText = createPulseSignUpTextStyles(DRIVER_SIGNUP);

const footerStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  row: { alignItems: 'center', paddingVertical: 2 },
  text: driverText.linkSmall,
  link: driverText.linkEmphasis,
});

export default function DriverSignInScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const safeBack = useSafeBack('/driver-signup');
  const isOnline = useIsOnline();
  const { user } = useAuth();
  const isDesktop = width >= 1024;

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const phoneInlineError = getPhoneInlineError(phone);

  // signInDriverByPhoneUnverified establishes a real Supabase session; AuthContext's
  // onAuthStateChange listener picks it up and updates `user` — once it does, hand
  // off to the root router the same way app/sign-in.tsx does after password/Google
  // sign-in, so role-based routing in app/index.tsx takes over.
  useEffect(() => {
    if (!user) return;
    router.replace('/');
  }, [user, router]);

  const handleBack = () => {
    if (step > 0) {
      setStep(0);
      setOtpValue('');
      return;
    }
    safeBack();
  };

  const handleSendOtp = async () => {
    setNotFound(false);
    if (!phone.trim()) {
      showAppAlert('Required', 'Enter your 10-digit mobile number.');
      return;
    }
    const err = getPhoneInlineError(phone);
    if (err) {
      showAppAlert('Invalid', err);
      return;
    }
    if (!isOnline) {
      showAppAlert('No internet', 'Connect to the internet to continue.');
      return;
    }
    setLoading(true);
    const fullPhoneForApi = getFullPhoneIndia(phone);
    const result = await checkExistingUserByPhone(fullPhoneForApi);
    setLoading(false);
    if (result.error) {
      showAppAlert('Check failed', result.error.message);
      return;
    }
    if (!result.exists) {
      setNotFound(true);
      return;
    }
    setOtpValue('');
    setStep(1);
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== OTP_LENGTH) return;
    if (!isOnline) {
      showAppAlert('No internet', 'Connect to the internet to continue.');
      return;
    }
    setVerifying(true);
    const fullPhoneForApi = getFullPhoneIndia(phone);
    const result = await signInDriverByPhoneUnverified(fullPhoneForApi);
    setVerifying(false);
    if (result.error) {
      showAppAlert('Could not sign in', result.error.message);
      return;
    }
    // Success: the useEffect above takes over once `user` updates.
  };

  const otpSubtitle =
    phone.trim().length === 10
      ? `Enter the 4-digit code we sent to +91 ${formatSignupPhoneDisplay(phone)}`
      : STEP_CONTENT[1].subtitle;

  return (
    <SignUpMobileShell
      backLabel="Back"
      onBack={handleBack}
      stepLabels={['Phone', 'Verify']}
      currentStepIndex={step}
      hideProgress
      bodyMode="keypad"
      trustMode="driver"
      isDesktop={isDesktop}
    >
      {step === 0 ? (
        <SignUpPulseKeypadStep
          theme={DRIVER_SIGNUP}
          heroMascotId={DRIVER_SIGNUP_HERO_MASCOT.phone}
          title={STEP_CONTENT[0].title}
          subtitle={STEP_CONTENT[0].subtitle}
          value={phone}
          onChange={(d) => setPhone(formatMobileNumber(d))}
          maxDigits={10}
          formatDisplay={formatSignupPhoneDisplay}
          displayFlag="🇮🇳"
          displayPrefix="+91"
          emptyPlaceholder="000 000 0000"
          onPrimary={handleSendOtp}
          primaryDisabled={!isPhoneStepValid(phone)}
          primaryLoading={loading}
          primaryLabel="Send OTP"
          errorMessage={phoneInlineError}
          hintMessage={notFound ? 'No account found for this number.' : null}
          footerAccessory={
            notFound ? (
              <View style={footerStyles.wrap}>
                <Pressable
                  style={footerStyles.row}
                  onPress={() => router.replace(ROUTES.ONBOARDING.DRIVER as Href)}
                >
                  <Text style={footerStyles.text}>
                    New driver? <Text style={footerStyles.link}>Sign up</Text>
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      ) : (
        <SignUpPulseKeypadStep
          theme={DRIVER_SIGNUP}
          heroMascotId={DRIVER_SIGNUP_HERO_MASCOT.verify}
          centeredLayout
          title={STEP_CONTENT[1].title}
          subtitle={otpSubtitle}
          value={otpValue}
          onChange={(d) => setOtpValue(d.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          maxDigits={OTP_LENGTH}
          formatDisplay={(d) => d}
          fieldLabel="Verification Code"
          emptyPlaceholder=""
          customDisplay={<SignUpOtpBoxes digits={otpValue} length={OTP_LENGTH} centered />}
          onPrimary={handleVerifyOtp}
          primaryDisabled={otpValue.length < OTP_LENGTH}
          primaryLoading={verifying}
          primaryLabel="Verify OTP"
          footerAccessory={
            <Pressable
              onPress={() => {
                setOtpValue('');
                setStep(0);
              }}
              style={footerStyles.row}
            >
              <Text style={footerStyles.text}>
                <Text style={footerStyles.link}>Change number</Text>
              </Text>
            </Pressable>
          }
        />
      )}
    </SignUpMobileShell>
  );
}
