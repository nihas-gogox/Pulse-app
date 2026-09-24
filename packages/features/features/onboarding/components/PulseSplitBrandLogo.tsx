import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PulseBrandMark } from '@pulse/ui/components/brand/PulseBrandMark';
import {
  DESKTOP_SIGNUP_SPLIT_PAD,
  DESKTOP_SPLIT_BRAND_TOP,
} from '@pulse/domain/features/auth/signup/signUpConstants';

export { PulseBrandMark, PulseBrandMarkLink } from '@pulse/ui/components/brand/PulseBrandMark';

type PulseSplitBrandLogoProps = {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Product wordmark — defaults to platform `pulse`. */
  word?: string;
};

/** Top-left pulse. anchor for desktop split rails (onboarding + sign-in). */
export function PulseSplitBrandLogo({
  style,
  onPress,
  accessibilityLabel = 'Pulse website',
  word,
}: PulseSplitBrandLogoProps) {
  if (!onPress) {
    return (
      <View style={[styles.anchor, style]} pointerEvents="none">
        <PulseBrandMark size="lg" word={word} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.anchor, style, pressed && styles.anchorPressed]}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
    >
      <PulseBrandMark size="lg" word={word} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: DESKTOP_SPLIT_BRAND_TOP,
    left: DESKTOP_SIGNUP_SPLIT_PAD,
    zIndex: 4,
  },
  anchorPressed: {
    opacity: 0.75,
  },
});
