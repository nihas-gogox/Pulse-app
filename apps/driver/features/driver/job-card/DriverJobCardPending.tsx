import Theme from '@pulse/core/constants/Theme';
import Layout from '@pulse/core/constants/Layout';
import { TRIP_SHEET_TOP_RADIUS } from '../../../components/driver/DriverTripSheetLayout';
import type { DriverTripFlowCardProps } from '../components/DriverTripFlowCard';
import * as tripsService from '@pulse/domain/features/trips/services/trips.service';
import { StyleSheet, Text, View } from 'react-native';

type Props = Pick<DriverTripFlowCardProps, 'edgeToEdge' | 'variant'> & {
  trip: tripsService.TripRow;
};

export function DriverJobCardPending({ trip, edgeToEdge = false, variant = 'card' }: Props) {
  const frameless = variant === 'page' || edgeToEdge;
  return (
    <View
      testID="driver-job-card-pending"
      style={[styles.sheet, frameless ? styles.edge : styles.inset]}
    >
      <Text style={styles.kicker}>Delivery</Text>
      <Text style={styles.title} numberOfLines={1}>
        {tripsService.resolveDriverFacingTripLabel(trip)}
      </Text>
      <Text style={styles.hint}>Loading stop list…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: Theme.surface,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopLeftRadius: TRIP_SHEET_TOP_RADIUS,
    borderTopRightRadius: TRIP_SHEET_TOP_RADIUS,
  },
  edge: {
    marginHorizontal: 0,
  },
  inset: {
    marginHorizontal: Layout.screenPaddingHorizontal,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: Theme.textMuted,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: Theme.textPrimaryDark,
  },
  hint: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: Theme.textMuted,
  },
});
