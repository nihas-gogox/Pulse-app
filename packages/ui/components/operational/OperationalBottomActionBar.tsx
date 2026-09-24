import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEffectiveBottomInset } from '@pulse/core/lib/safeAreaWeb';

import { colors } from '@/design-system/colors';
import { layout } from '@/design-system/layout';
import { space } from '@/design-system/spacing';

export interface OperationalBottomActionBarProps {
  children: ReactNode;
  /** When false, safe-area inset is omitted (e.g. keypad step — shell footer owns inset). */
  reserveSafeArea?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Sticky bottom zone for primary operational commits (thumb reach). */
export const OperationalBottomActionBar = memo(function OperationalBottomActionBar({
  children,
  reserveSafeArea = true,
  style,
}: OperationalBottomActionBarProps) {
  const bottomInset = useEffectiveBottomInset();

  return (
    <View
      style={[
        styles.bar,
        {
          // Keep a real thumb band even when RN web reports inset 0.
          paddingBottom: reserveSafeArea
            ? Math.max(bottomInset, space[4])
            : space[3],
          paddingHorizontal: layout.screenPaddingX,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexShrink: 0,
    paddingTop: space[3],
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    zIndex: 2,
  },
});
