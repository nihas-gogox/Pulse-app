import { memo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { colors } from '@/design-system/colors';
import { layout } from '@/design-system/layout';
import { space } from '@/design-system/spacing';
import { typography } from '@/design-system/typography';
import { useOperationalDensity, type DensityTier } from './useOperationalDensity';

export type OperationalHeaderVariant = 'stack' | 'detail' | 'modal' | 'onboarding';

export interface OperationalHeaderProps {
  title: string;
  subtitle?: string;
  /** Breadcrumb trail — last segment is current context */
  breadcrumbs?: readonly string[];
  variant?: OperationalHeaderVariant;
  density?: DensityTier;
  onBack?: () => void;
  backLabel?: string;
  /** Dominant header action (one only) */
  primaryAction?: ReactNode;
  /** Utility cluster — max 2 items recommended */
  trailing?: ReactNode;
  /** KPI strip below title row */
  metrics?: ReactNode;
  skipSafeAreaTop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const OperationalHeader = memo(function OperationalHeader({
  title,
  subtitle,
  breadcrumbs,
  variant = 'stack',
  density: densityTier = 'medium',
  onBack,
  backLabel = 'Back',
  primaryAction,
  trailing,
  metrics,
  skipSafeAreaTop = false,
  style,
}: OperationalHeaderProps) {
  const insets = useSafeAreaInsets();
  const d = useOperationalDensity(densityTier);
  const isDark = variant === 'stack';
  // Dark stack headers need light ink — never `textOnBrand` (brown for pastel pills).
  const fg = isDark ? '#f8fafc' : colors.textPrimary;
  const fgMuted = isDark ? 'rgba(248,250,252,0.78)' : colors.textSecondary;

  const topPad = skipSafeAreaTop ? space[4] : insets.top + space[4];

  return (
    <View
      style={[
        styles.root,
        isDark && styles.rootDark,
        { paddingTop: topPad, paddingBottom: d.sectionGap / 2 },
        style,
      ]}
    >
      <View style={[styles.row, { paddingHorizontal: layout.screenPaddingX }]}>
        <View style={styles.leading}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <ChevronLeft size={20} color={fg} strokeWidth={2.5} />
              <Text style={[styles.backText, { color: fgMuted }]}>{backLabel}</Text>
            </Pressable>
          ) : null}

          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Text style={[styles.breadcrumb, { color: fgMuted }]} numberOfLines={1}>
              {breadcrumbs.join(' / ')}
            </Text>
          ) : null}

          <Text
            style={[
              densityTier === 'low' ? typography.heading : typography.title,
              { color: fg },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: fgMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.trailingCluster}>
          {trailing}
          {primaryAction}
        </View>
      </View>

      {metrics ? (
        <View style={[styles.metrics, { paddingHorizontal: layout.screenPaddingX }]}>
          {metrics}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    // RN Web ScrollView is often position:absolute and paints over siblings.
    zIndex: 3,
    elevation: 3,
    position: "relative",
  },
  rootDark: {
    backgroundColor: colors.operational,
    borderBottomColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  leading: {
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    marginBottom: space[2],
    marginLeft: -4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: space[1],
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: space[1],
  },
  trailingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
    paddingTop: 2,
  },
  metrics: {
    marginTop: space[3],
  },
});
