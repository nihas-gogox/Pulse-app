import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/design-system/colors';
import { layout } from '@/design-system/layout';
import { radius } from '@/design-system/radius';
import { space } from '@/design-system/spacing';
import { useOperationalDensity, type DensityTier } from './useOperationalDensity';

function SkeletonBlock({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, opacity },
        style,
      ]}
    />
  );
}

export interface OperationalListRowSkeletonProps {
  count?: number;
  density?: DensityTier;
  showDivider?: boolean;
}

export const OperationalListRowSkeleton = memo(function OperationalListRowSkeleton({
  count = 6,
  density: densityTier = 'medium',
  showDivider = true,
}: OperationalListRowSkeletonProps) {
  const d = useOperationalDensity(densityTier);

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            {
              paddingVertical: d.listRowPaddingY,
              paddingHorizontal: d.listRowPaddingX,
            },
            showDivider && styles.divider,
          ]}
        >
          <SkeletonBlock width={36} height={36} style={{ borderRadius: radius.md }} />
          <View style={styles.rowBody}>
            <SkeletonBlock width="55%" height={14} />
            <SkeletonBlock width="40%" height={11} style={{ marginTop: space[2] }} />
          </View>
          <SkeletonBlock width={72} height={18} />
        </View>
      ))}
    </View>
  );
});

export interface OperationalMetricSkeletonProps {
  columns?: number;
  density?: DensityTier;
}

export const OperationalMetricSkeleton = memo(function OperationalMetricSkeleton({
  columns = 3,
  density: densityTier = 'medium',
}: OperationalMetricSkeletonProps) {
  const _d = useOperationalDensity(densityTier);

  return (
    <View style={[styles.metricRow, { paddingHorizontal: layout.screenPaddingX, gap: space[3] }]}>
      {Array.from({ length: columns }).map((_, i) => (
        <View key={i} style={styles.metricCell}>
          <SkeletonBlock width="50%" height={10} />
          <SkeletonBlock width="80%" height={22} style={{ marginTop: space[2] }} />
        </View>
      ))}
    </View>
  );
});

export interface OperationalDetailSkeletonProps {
  density?: DensityTier;
}

export const OperationalDetailSkeleton = memo(function OperationalDetailSkeleton({
  density: densityTier = 'medium',
}: OperationalDetailSkeletonProps) {
  const d = useOperationalDensity(densityTier);

  return (
    <View style={{ paddingHorizontal: layout.screenPaddingX, paddingTop: d.sectionGap }}>
      <SkeletonBlock width="70%" height={24} />
      <SkeletonBlock width="45%" height={14} style={{ marginTop: space[3] }} />
      <OperationalMetricSkeleton columns={3} density={densityTier} />
      <View style={{ marginTop: space[4] }}>
        <OperationalListRowSkeleton count={4} density={densityTier} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#e2e8f0',
    borderRadius: radius.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  metricRow: {
    flexDirection: 'row',
    marginTop: space[4],
    marginBottom: space[2],
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
});
