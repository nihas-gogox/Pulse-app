import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';

import { ROUTES } from '@pulse/core/lib/routes';
import { clearDriverSignupSuccess } from '@pulse/domain/lib/onboarding/businessSignupBranding.util';
import { PULSE_PILOT_BRAND_WORD } from '@pulse/core/lib/brand/pulseBrandMark.tokens';
import { SignUpPulseFormStep } from '../SignUpPulseFormStep';
import {
  DriverSignupReadyCard,
  type DriverReadyCheckpoint,
} from '@pulse/ui/features/auth/signup/components/DriverSignupReadyCard';
import { DRIVER_SIGNUP } from '@pulse/domain/features/auth/signup/signUpDriverTheme';

export interface DriverSignupSuccessStepProps {
  displayName: string;
  onEnterApp: () => void;
  profilePreviewUri?: string | null;
  profileImage?: ImageSourcePropType;
  licenseUploaded: boolean;
  aadhaarUploaded: boolean;
  panUploaded: boolean;
  licenseSkipped: boolean;
  aadhaarSkipped: boolean;
  panSkipped: boolean;
}

function buildDriverCheckpoints({
  licenseUploaded,
  aadhaarUploaded,
  panUploaded,
  licenseSkipped,
  aadhaarSkipped,
  panSkipped,
}: Omit<DriverSignupSuccessStepProps, 'displayName' | 'onEnterApp'>): DriverReadyCheckpoint[] {
  const docResolved = (uploaded: boolean, skipped: boolean) => uploaded || skipped;
  const docsDone =
    docResolved(licenseUploaded, licenseSkipped) &&
    docResolved(aadhaarUploaded, aadhaarSkipped) &&
    docResolved(panUploaded, panSkipped);
  const uploadedCount = [licenseUploaded, aadhaarUploaded, panUploaded].filter(Boolean).length;
  const skippedCount = [licenseSkipped, aadhaarSkipped, panSkipped].filter(Boolean).length;

  let docsDetail = `${uploadedCount} of 3 documents on file`;
  if (skippedCount > 0) {
    docsDetail = `${uploadedCount} uploaded · ${skippedCount} later from profile`;
  }

  return [
    { id: 'account', label: 'Driver account live', status: 'complete' },
    {
      id: 'docs',
      label: 'Compliance documents',
      status: docsDone ? 'complete' : 'in_progress',
      detail: docsDetail,
    },
    { id: 'photo', label: 'Profile identity set', status: 'complete' },
    {
      id: 'trips',
      label: 'Trip access',
      status: docsDone ? 'complete' : 'in_progress',
      detail: docsDone
        ? 'Cleared to accept trips'
        : 'Upload remaining docs to unlock all trips',
    },
  ];
}

export function DriverSignupSuccessStep({
  displayName,
  onEnterApp,
  profilePreviewUri,
  profileImage,
  licenseUploaded,
  aadhaarUploaded,
  panUploaded,
  licenseSkipped,
  aadhaarSkipped,
  panSkipped,
}: DriverSignupSuccessStepProps) {
  const router = useRouter();
  const trimmedName = displayName.trim() || 'Driver';

  const handleEnterApp = () => {
    clearDriverSignupSuccess();
    onEnterApp();
  };

  return (
    <SignUpPulseFormStep
      title="You're cleared"
      subtitle={`Welcome to ${PULSE_PILOT_BRAND_WORD} — your pilot profile is ready.`}
      primaryLabel="Open driver app"
      onPrimary={handleEnterApp}
      theme={DRIVER_SIGNUP}
      centerContent
      titleCentered
      secondaryAction={{
        label: 'Sign in on another device',
        onPress: () => {
          clearDriverSignupSuccess();
          router.replace(ROUTES.SIGN_IN);
        },
      }}
    >
      <View style={styles.cardWrap}>
        <DriverSignupReadyCard
          displayName={trimmedName}
          profilePreviewUri={profilePreviewUri}
          profileImage={profileImage}
          checkpoints={buildDriverCheckpoints({
            licenseUploaded,
            aadhaarUploaded,
            panUploaded,
            licenseSkipped,
            aadhaarSkipped,
            panSkipped,
          })}
        />
      </View>
    </SignUpPulseFormStep>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
