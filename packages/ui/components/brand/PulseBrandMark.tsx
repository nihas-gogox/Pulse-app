import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  PULSE_BRAND_MARK_COLORS,
  PULSE_BRAND_MARK_SIZES,
  PULSE_BRAND_MARK_TYPO,
  PULSE_BRAND_MARK_WORD,
  type PulseBrandMarkSize,
} from '@pulse/core/lib/brand/pulseBrandMark.tokens';

export type PulseBrandMarkVariant = keyof typeof PULSE_BRAND_MARK_COLORS;

type PulseBrandMarkProps = {
  /** Word before the yellow dot — defaults to platform `pulse`. */
  word?: string;
  size?: PulseBrandMarkSize;
  variant?: PulseBrandMarkVariant;
  wordColor?: string;
  dotColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

/** Standard pulse. wordmark — lowercase italic ink + yellow dot. */
export const PulseBrandMark = memo(function PulseBrandMark({
  word = PULSE_BRAND_MARK_WORD,
  size = 'lg',
  variant = 'ink',
  wordColor,
  dotColor,
  style,
  textStyle,
  numberOfLines,
}: PulseBrandMarkProps) {
  const metrics = PULSE_BRAND_MARK_SIZES[size];
  const palette = PULSE_BRAND_MARK_COLORS[variant];
  const resolvedWordColor = wordColor ?? palette.word;
  const resolvedDotColor = dotColor ?? palette.dot;

  const mark = (
    <Text
      style={[
        styles.word,
        metrics,
        { color: resolvedWordColor },
        textStyle,
      ]}
      numberOfLines={numberOfLines}
    >
      {word}
      <Text style={[styles.dot, { color: resolvedDotColor }]}>.</Text>
    </Text>
  );

  if (style == null) return mark;
  return <View style={style}>{mark}</View>;
});

type PulseBrandMarkLinkProps = PulseBrandMarkProps & {
  onPress: () => void;
  accessibilityLabel?: string;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
  linkStyle?: StyleProp<ViewStyle>;
};

/** Pressable pulse. mark — footer / external website link. */
export const PulseBrandMarkLink = memo(function PulseBrandMarkLink({
  onPress,
  accessibilityLabel = 'Pulse website',
  hitSlop = { top: 8, bottom: 8, left: 4, right: 8 },
  linkStyle,
  ...markProps
}: PulseBrandMarkLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, linkStyle, pressed && styles.linkPressed]}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
    >
      <PulseBrandMark {...markProps} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  word: {
    ...PULSE_BRAND_MARK_TYPO,
  },
  dot: {
    ...PULSE_BRAND_MARK_TYPO,
  },
  linkRow: {
    alignSelf: 'flex-start',
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkPressed: {
    opacity: 0.75,
  },
});
