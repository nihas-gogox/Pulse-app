import { StyleSheet, Text, View } from 'react-native';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { formatStopAddress } from '../../commerce-mission/driverCommerceMissionLabels';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import { formatStopPlace } from '../multiOrderStopCopy';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  stop: DriverStopExecutionStop;
  customerName: string | null;
};

export function StopLocationCard({ colors, stop, customerName }: Props) {
  const address = formatStopAddress(stop);
  return (
    <View testID="stop-verification-location" style={styles.wrap}>
      <Text style={[styles.place, { color: colors.text }]} numberOfLines={2}>
        {formatStopPlace(stop)}
      </Text>
      {customerName ? (
        <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
          {customerName}
        </Text>
      ) : null}
      {address ? (
        <Text style={[styles.addr, { color: colors.textMuted }]} numberOfLines={2}>
          {address}
        </Text>
      ) : stop.city ? (
        <Text style={[styles.addr, { color: colors.textMuted }]} numberOfLines={1}>
          {stop.city}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  place: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  customer: {
    fontSize: 12,
    fontWeight: '600',
  },
  addr: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
});
