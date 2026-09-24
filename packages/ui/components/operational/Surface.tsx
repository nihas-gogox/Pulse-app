import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation } from '@/design-system/elevation';
import { radius } from '@/design-system/radius';
import { useOperationalDensity, type DensityTier } from './useOperationalDensity';

export type SurfaceElevation = 0 | 1 | 2;

export interface SurfaceProps {
  children: ReactNode;
  elevation?: SurfaceElevation;
  density?: DensityTier;
  /** Optional — defaults from density tier */
  paddingHorizontal?: number;
  paddingVertical?: number;
  style?: StyleProp<ViewStyle>;
  /** Hairline separator below (lists) — not a full border box */
  dividerBottom?: boolean;
}

/**
 * Replaces random bordered cards. Use elevation + spacing — not nested borders.
 */
export const Surface = memo(function Surface({
  children,
  elevation: level = 1,
  density: densityTier = 'medium',
  paddingHorizontal,
  paddingVertical,
  style,
  dividerBottom = false,
}: SurfaceProps) {
  const d = useOperationalDensity(densityTier);
  const padH = paddingHorizontal ?? d.listRowPaddingX;
  const padV = paddingVertical ?? d.listRowPaddingY;

  return (
    <View
      style={[
        elevation(level),
        styles.base,
        {
          paddingHorizontal: padH,
          paddingVertical: padV,
          borderRadius: level === 0 ? 0 : radius.lg,
        },
        dividerBottom && styles.dividerBottom,
        style,
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  dividerBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
});
