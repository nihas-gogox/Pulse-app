import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/design-system/colors';
import { tabularNums, typography } from '@/design-system/typography';

export type MetricTone = 'neutral' | 'revenue' | 'cost' | 'pending' | 'brand';
export type MetricSize = 'compact' | 'default' | 'hero';

export interface MetricDisplayProps {
  value: string;
  label?: string;
  /** e.g. "+12%" or "vs last week" */
  delta?: string;
  deltaTone?: MetricTone;
  tone?: MetricTone;
  size?: MetricSize;
  align?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
}

const TONE_COLOR: Record<MetricTone, string> = {
  neutral: colors.textPrimary,
  revenue: colors.revenue,
  cost: colors.cost,
  pending: colors.pending,
  brand: colors.brand,
};

export const MetricDisplay = memo(function MetricDisplay({
  value,
  label,
  delta,
  deltaTone = 'neutral',
  tone = 'neutral',
  size = 'default',
  align = 'right',
  style,
}: MetricDisplayProps) {
  const valueStyle =
    size === 'hero'
      ? typography.metric
      : size === 'compact'
        ? typography.metricSm
        : typography.metric;

  return (
    <View style={[styles.wrap, align === 'right' && styles.alignRight, style]}>
      {label ? (
        <Text style={[styles.label, align === 'right' && styles.textRight]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <Text
        style={[
          valueStyle,
          tabularNums,
          { color: TONE_COLOR[tone], fontSize: size === 'compact' ? 18 : valueStyle.fontSize },
          align === 'right' && styles.textRight,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      {delta ? (
        <Text
          style={[
            styles.delta,
            { color: TONE_COLOR[deltaTone] },
            align === 'right' && styles.textRight,
          ]}
          numberOfLines={1}
        >
          {delta}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  textRight: {
    textAlign: 'right',
  },
  label: {
    ...typography.label,
    fontSize: 10,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  delta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    ...tabularNums,
  },
});
