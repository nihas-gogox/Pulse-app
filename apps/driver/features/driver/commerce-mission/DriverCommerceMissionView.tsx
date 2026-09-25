import Theme from '@pulse/core/constants/Theme';
import { formatINR } from '@pulse/core/lib/format';
import type {
  DriverTripStopOrderMission,
  DriverTripStopOrderStop,
} from './driverTripStopOrders.types';
import { hasCommerceExecutionPlan } from './normalizeDriverTripStopOrders';
import {
  formatDeliveryWindow,
  formatStopAddress,
  stopExecutionLabel,
  stopKindLabel,
} from './driverCommerceMissionLabels';
import { StyleSheet, Text, View } from 'react-native';

export type DriverCommerceMissionViewColors = {
  text: string;
  textMuted: string;
  surface: string;
  border: string;
};

const DEFAULT_COLORS: DriverCommerceMissionViewColors = {
  text: Theme.textPrimary,
  textMuted: Theme.textMuted,
  surface: Theme.surface,
  border: Theme.surfaceBorder,
};

type Props = {
  mission: DriverTripStopOrderMission;
  loadError?: string | null;
  colors?: DriverCommerceMissionViewColors;
};

function OrderCard({
  stop,
  colors,
}: {
  stop: DriverTripStopOrderStop;
  colors: DriverCommerceMissionViewColors;
}) {
  const address = formatStopAddress(stop);
  return (
    <>
      {stop.orders.map((order) => {
        const window = formatDeliveryWindow(order.deliveryWindowStart, order.deliveryWindowEnd);
        const qty = order.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
        const sales =
          order.orderTotalAmount != null && Number.isFinite(order.orderTotalAmount)
            ? formatINR(order.orderTotalAmount)
            : null;
        return (
          <View
            key={order.salesOrderId}
            style={[styles.orderCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            testID={`commerce-mission-order-${order.salesOrderId}`}
          >
            <Text style={[styles.orderNumber, { color: colors.text }]}>
              {order.orderNumber ?? order.salesOrderId}
            </Text>
            {order.customerName ? (
              <Text style={[styles.body, { color: colors.text }]}>{order.customerName}</Text>
            ) : null}
            {order.customerPhone ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{order.customerPhone}</Text>
            ) : null}
            {address ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{address}</Text>
            ) : null}
            {qty > 0 ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {order.lines.length > 1 ? `${order.lines.length} lines · ` : ''}
                {qty} {qty === 1 ? 'item' : 'items'}
              </Text>
            ) : null}
            {window ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>Window: {window}</Text>
            ) : null}
            {order.priority ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>Priority: {order.priority}</Text>
            ) : null}
            {order.notes ? (
              <Text style={[styles.meta, { color: colors.textMuted }]}>{order.notes}</Text>
            ) : null}
            {sales ? (
              <Text style={[styles.sales, { color: colors.text }]}>Order value {sales}</Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

/**
 * Read-only Commerce delivery mission. No Arrive / Complete / POD / fail actions.
 */
export function DriverCommerceMissionView({ mission, loadError, colors = DEFAULT_COLORS }: Props) {
  const commerce = hasCommerceExecutionPlan(mission);

  return (
    <View testID="commerce-mission-view">
      {loadError ? (
        <Text style={[styles.message, { color: colors.textMuted }]} accessibilityRole="alert">
          Could not load this delivery mission. Try again later.
        </Text>
      ) : null}

      {!loadError && !commerce ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>
          This trip has no Commerce order list.
        </Text>
      ) : null}

      {!loadError && commerce && mission.stops.length === 0 ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>
          No delivery stops to show.
        </Text>
      ) : null}

      {commerce && !loadError
        ? mission.stops.map((stop, index) => (
            <View
              key={stop.stopId}
              style={[styles.stopBlock, { borderColor: colors.border }]}
              testID={`commerce-mission-stop-${stop.stopId}`}
            >
              <Text style={[styles.stopTitle, { color: colors.text }]}>
                Stop {index + 1} — {stopKindLabel(stop.stopType)}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {stop.displayName ?? stop.label ?? `Stop ${stop.sequence}`}
                {' · '}
                {stopExecutionLabel(stop.stopExecutionStatus)}
              </Text>
              {stop.podRequired ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  POD required at this stop
                </Text>
              ) : null}
              {stop.stopType === 'drop' && stop.stopDistinctDropOrderCount > 1 ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {stop.stopDistinctDropOrderCount} orders share this drop
                </Text>
              ) : null}
              <OrderCard stop={stop} colors={colors} />
              {stop.orders.length === 0 ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>No orders at this stop</Text>
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  stopBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stopTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontSize: 15,
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  sales: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
});
