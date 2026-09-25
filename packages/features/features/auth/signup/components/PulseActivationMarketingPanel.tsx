import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Theme from '@pulse/core/constants/Theme';
import { WorkspaceOutcomeTypewriter } from '../../../onboarding/components/WorkspaceOutcomeTypewriter';
import { ONBOARDING_BRAND } from '@pulse/domain/features/onboarding/components/onboardingPersonaAssets';
import { PulseSplitBrandLogo } from '../../../onboarding/components/PulseSplitBrandLogo';
import { ROUTES } from '@pulse/core/lib/routes';
import { DESKTOP_SIGNUP_SPLIT_FLOW_PAD_Y } from '@pulse/domain/features/auth/signup/signUpConstants';
import {
  SIGNUP_MARKETING_ILLUSTRATION,
  SIGNUP_MARKETING_ILLUSTRATION_ASPECT,
} from '@pulse/ui/lib/signup/signUpMarketingAssets';
import { PULSE_SIGNUP_TYPO } from '@pulse/domain/features/auth/signup/signUpTypography';

const PANEL_CONTENT_MAX = 400;
const ILLUSTRATION_WIDTH = 220;

export type PulseActivationMarketingPanelProps = {
  brandWord?: string;
  tag?: string;
  title?: string;
  /** Typewriter lines under the headline — defaults to workspace setup outcomes. */
  outcomeLines?: readonly string[];
};

const Illustration = SIGNUP_MARKETING_ILLUSTRATION;
const illustrationHeight = ILLUSTRATION_WIDTH / SIGNUP_MARKETING_ILLUSTRATION_ASPECT;

/** Desktop signup split — mirrors hub left panel layout. */
export function PulseActivationMarketingPanel({
  brandWord,
  tag = 'Workspace setup',
  title = 'One workspace for your entire transport business.',
  outcomeLines,
}: PulseActivationMarketingPanelProps) {
  const router = useRouter();

  return (
    <View style={styles.panel}>
      <PulseSplitBrandLogo
        word={brandWord}
        onPress={() => router.push(ROUTES.TERMINAL_WEBSITE)}
      />

      <View style={styles.body}>
        <View style={styles.inner}>
          <View style={styles.copy}>
            <Text style={styles.tag}>{tag}</Text>
            <Text style={styles.title}>{title}</Text>
            <WorkspaceOutcomeTypewriter lines={outcomeLines} />
          </View>

          <View style={styles.illustrationWrap}>
            <Illustration width={ILLUSTRATION_WIDTH} height={illustrationHeight} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    position: 'relative',
    backgroundColor: Theme.screenBackground,
    minWidth: 0,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    width: '100%',
    paddingVertical: DESKTOP_SIGNUP_SPLIT_FLOW_PAD_Y,
  },
  inner: {
    width: '100%',
    maxWidth: PANEL_CONTENT_MAX,
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingBottom: 36,
    gap: 22,
  },
  copy: {
    width: '100%',
  },
  tag: {
    ...PULSE_SIGNUP_TYPO.label,
    color: Theme.textMuted,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    color: ONBOARDING_BRAND.ink,
    letterSpacing: -0.45,
    marginBottom: 12,
    maxWidth: 340,
  },
  illustrationWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
});
