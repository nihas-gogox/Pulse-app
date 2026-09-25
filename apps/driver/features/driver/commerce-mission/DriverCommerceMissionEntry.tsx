/**
 * Job Card CTA to the read-only Commerce Delivery Mission (explicit route only).
 *
 * Do not mount this on the generic Job Card. Legacy trips must never request
 * Primitive A or show Commerce widgets. Multi-order trips hydrate orders
 * from DriverMultiOrderJobCard after SES has chosen that mode.
 */
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import Layout from '@pulse/core/constants/Layout';
import { ROUTES } from '@pulse/core/lib/routes';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  tripId: string;
};

export function DriverCommerceMissionEntry({ tripId }: Props) {
  const router = useRouter();
  const colors = useDriverThemeColors();

  return (
    <Pressable
      testID="commerce-mission-entry"
      accessibilityRole="button"
      accessibilityLabel="Delivery Mission, View orders"
      onPress={() => router.push(ROUTES.driverCommerceMission(tripId) as Href)}
      style={[
        styles.cta,
        { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Delivery Mission</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>View orders</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    minHeight: Layout.minTouchTargetSize,
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginBottom: Layout.spacingMedium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
