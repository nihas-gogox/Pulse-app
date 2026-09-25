import type { ReactNode } from 'react';
import Layout from '@pulse/core/constants/Layout';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { formatStopAddress } from '../../commerce-mission/driverCommerceMissionLabels';
import type { DriverTripStopOrder } from '../../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import {
  callActionLabel,
  formatStopKm,
  formatStopPlace,
  stopRoleLabel,
} from '../multiOrderStopCopy';
import { MapPin, Phone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Colors = ReturnType<typeof getDriverThemeColors>;

const MAX_ORDER_CHIPS = 4;

type Props = {
  colors: Colors;
  stop: DriverStopExecutionStop;
  orders: DriverTripStopOrder[];
  ordersLoading: boolean;
  distanceKm: number | null | undefined;
  children?: ReactNode;
};

export function CurrentStopCard({
  colors,
  stop,
  orders,
  ordersLoading,
  distanceKm,
  children,
}: Props) {
  const place = formatStopPlace(stop);
  const address = formatStopAddress(stop);
  const role = stopRoleLabel(String(stop.stopType));
  const customers = [...new Set(orders.map((o) => o.customerName?.trim()).filter(Boolean))] as string[];
  const phone =
    stop.contactPhone?.trim()
    || orders.find((o) => o.customerPhone?.trim())?.customerPhone?.trim()
    || null;
  const km = formatStopKm(distanceKm ?? undefined);
  const visible = orders.slice(0, MAX_ORDER_CHIPS);
  const extra = orders.length - visible.length;

  return (
    <View
      testID="multi-order-current-stop"
      style={[styles.card, { borderColor: colors.border }]}
    >
      <View style={styles.head}>
        <Text style={[styles.role, { color: colors.emerald }]}>{role}</Text>
        {km ? (
          <Text style={[styles.km, { color: colors.textMuted }]}>{km}</Text>
        ) : null}
      </View>
      <Text style={[styles.place, { color: colors.text }]} numberOfLines={2}>
        {place}
      </Text>
      {customers[0] ? (
        <Text style={[styles.customer, { color: colors.text }]} numberOfLines={1}>
          {customers[0]}
        </Text>
      ) : null}
      {address ? (
        <View style={styles.addrRow}>
          <MapPin size={12} color={colors.textMuted} strokeWidth={2} />
          <Text style={[styles.addr, { color: colors.textMuted }]} numberOfLines={2}>
            {address}
          </Text>
        </View>
      ) : stop.city ? (
        <Text style={[styles.addr, { color: colors.textMuted }]} numberOfLines={1}>
          {stop.city}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {orders.length > 0 ? (
          <View style={styles.chips} testID="multi-order-stop-orders">
            {visible.map((order) => (
              <View
                key={order.salesOrderId}
                style={[styles.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                  {order.orderNumber ?? order.customerName ?? order.salesOrderId}
                </Text>
              </View>
            ))}
            {extra > 0 ? (
              <View style={[styles.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textMuted }]}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        ) : ordersLoading ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading orders…</Text>
        ) : (
          <View style={styles.chips} />
        )}
        {phone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${phone}`)}
            accessibilityRole="button"
            accessibilityLabel={callActionLabel(String(stop.stopType))}
            hitSlop={Layout.touchTargetHitSlop}
            style={[styles.call, { borderColor: colors.emeraldBorder }]}
          >
            <Phone size={13} color={colors.emerald} strokeWidth={2.2} />
            <Text style={[styles.callText, { color: colors.emerald }]}>
              {callActionLabel(String(stop.stopType))}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    gap: 5,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  role: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  km: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  place: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  customer: {
    fontSize: 12,
    fontWeight: '600',
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  addr: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  chips: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  muted: { fontSize: 11 },
  call: {
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  callText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
