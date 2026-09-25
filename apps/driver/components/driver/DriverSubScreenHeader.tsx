/**
 * Centered back + title sub-header for driver stack detail screens.
 * Visually aligned with `app/(driver)/profile.tsx` top bar (blur-tint bar, not a full solid block).
 */
import Layout from '@pulse/core/constants/Layout';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON_W = 44;

type Props = {
  title: string;
  /** Optional second line (e.g. passbook / KYC context). */
  subtitle?: string;
  onBack: () => void;
  backAccessibilityLabel?: string;
  /** When true, back button is a left chevron; when false, uses arrow-left (some lists use it). */
  backIcon?: 'chevron' | 'arrow';
  /** Optional trailing control (e.g. Add). Keeps 44pt side column balanced. */
  right?: ReactNode;
};

export function DriverSubScreenHeader({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel = 'Go back',
  backIcon = 'chevron',
  right,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useDriverTheme();
  const isDark = theme === 'dark';
  const colors = useDriverThemeColors();

  const backName = backIcon === 'arrow' ? 'arrow-left' : 'chevron-left';

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 8,
          paddingBottom: subtitle ? 10 : 12,
          paddingHorizontal: Layout.screenPaddingHorizontal,
          borderBottomColor: colors.border,
          backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.85)',
        },
      ]}
    >
      <TouchableOpacity style={styles.side} onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={backAccessibilityLabel}>
        <FontAwesome name={backName} size={backIcon === 'arrow' ? 20 : 18} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={subtitle ? 1 : 2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>{right ?? null}</View>
    </View>
  );
}

/** Screen root background: slate-tint light page vs theme dark (matches profile). */
export function driverDetailPageBackground(isDark: boolean, colorsBackground: string): string {
  return isDark ? colorsBackground : '#f8fafc';
}

export const DRIVER_DETAIL_HORIZONTAL_PAD = Layout.screenPaddingHorizontal;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: ICON_W,
  },
  side: {
    width: ICON_W,
    height: ICON_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
    paddingHorizontal: 8,
    width: '100%',
  },
});
