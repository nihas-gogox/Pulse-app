import { memo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@pulse/core/design-system/colors';
import { space } from '@pulse/core/design-system/spacing';
import { typography } from '@pulse/core/design-system/typography';
import { MetricDisplay, type MetricTone } from './MetricDisplay';
import { useOperationalDensity, type DensityTier } from './useOperationalDensity';

export type OperationalRowPreset = 'trip' | 'finance' | 'driver' | 'bid' | 'settlement' | 'generic';

export type OperationalRowState = 'default' | 'active' | 'warning' | 'muted';

export interface OperationalListRowProps {
  title: string;
  subtitle?: string;
  /** Status dot, avatar, or icon */
  leading?: ReactNode;
  /** Tabular amount or custom trailing */
  amount?: string;
  amountTone?: MetricTone;
  amountLabel?: string;
  trailing?: ReactNode;
  /** Compact status pill text */
  statusLabel?: string;
  statusTone?: MetricTone;
  preset?: OperationalRowPreset;
  state?: OperationalRowState;
  density?: DensityTier;
  onPress?: () => void;
  /** Quick action chips (right of title block) */
  quickActions?: ReactNode;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
}

const STATE_BG: Record<OperationalRowState, string | undefined> = {
  default: undefined,
  active: '#f0fdf4',
  warning: '#fffbeb',
  muted: colors.surface,
};

const STATUS_DOT: Record<MetricTone, string> = {
  neutral: colors.operationalMuted,
  revenue: colors.revenue,
  cost: colors.cost,
  pending: colors.pending,
  brand: colors.brand,
};

export const OperationalListRow = memo(function OperationalListRow({
  title,
  subtitle,
  leading,
  amount,
  amountTone = 'neutral',
  amountLabel,
  trailing,
  statusLabel,
  statusTone = 'neutral',
  preset: _preset = 'generic',
  state = 'default',
  density: densityTier = 'medium',
  onPress,
  quickActions,
  showDivider = true,
  style,
}: OperationalListRowProps) {
  const d = useOperationalDensity(densityTier);
  const padY = d.listRowPaddingY;
  const padX = d.listRowPaddingX;
  const bg = STATE_BG[state];

  const content = (
    <View
      style={[
        styles.row,
        {
          paddingVertical: padY,
          paddingHorizontal: padX,
          backgroundColor: bg,
        },
        showDivider && styles.divider,
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      {!leading && statusLabel ? (
        <View style={[styles.dot, { backgroundColor: STATUS_DOT[statusTone] }]} />
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[
              densityTier === 'high' ? styles.titleDense : styles.title,
              state === 'muted' && styles.titleMuted,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {quickActions ? <View style={styles.quick}>{quickActions}</View> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={densityTier === 'high' ? 1 : 2}>
            {subtitle}
          </Text>
        ) : null}
        {statusLabel && leading ? (
          <View style={[styles.statusPill, { borderColor: STATUS_DOT[statusTone] }]}>
            <Text style={[styles.statusText, { color: STATUS_DOT[statusTone] }]}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {amount ? (
          <MetricDisplay
            value={amount}
            label={amountLabel}
            tone={amountTone}
            size={densityTier === 'high' ? 'compact' : 'default'}
            align="right"
          />
        ) : null}
        {trailing}
        {statusLabel && !leading ? (
          <View style={[styles.statusPill, styles.statusPillTrailing, { borderColor: STATUS_DOT[statusTone] }]}>
            <Text style={[styles.statusText, { color: STATUS_DOT[statusTone] }]}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 48,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  leading: {
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  title: {
    ...typography.bodyMedium,
    flex: 1,
    minWidth: 0,
  },
  titleDense: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  titleMuted: {
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  quick: {
    flexShrink: 0,
  },
  trailing: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: space[1],
    maxWidth: '42%',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: space[1],
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillTrailing: {
    marginTop: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
