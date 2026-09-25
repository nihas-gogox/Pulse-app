import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverTripStopOrder } from '../../commerce-mission/driverTripStopOrders.types';
import { commerceProductImageUrl } from '../commerceProductImageUrl';
import {
  expectedQtyLabel,
  itemRowLabel,
  orderExpectedQty,
  qtyLabel,
  stopVerificationTotals,
} from '../stopVerificationSummary';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  orders: readonly DriverTripStopOrder[];
  delivery: boolean;
};

function LineThumb({
  colors,
  imagePath,
  label,
}: {
  colors: Colors;
  imagePath: string | null | undefined;
  label: string;
}) {
  const uri = commerceProductImageUrl(imagePath);
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View
        style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        accessibilityLabel={`${label} image unavailable`}
      />
    );
  }
  return (
    <Image
      testID="stop-verification-item-image"
      source={{ uri }}
      style={styles.thumb}
      accessibilityLabel={`${label} image`}
      onError={() => setFailed(true)}
    />
  );
}

export function StopOrderList({ colors, orders, delivery }: Props) {
  return (
    <View style={styles.wrap} testID="stop-verification-orders">
      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.textMuted }]}>
          {delivery ? 'Order detail' : 'Pickup detail'}
        </Text>
        <Text style={[styles.totals, { color: colors.text }]}>
          {expectedQtyLabel(stopVerificationTotals(orders))}
        </Text>
      </View>

      {orders.map((order) => {
        const qty = orderExpectedQty(order);
        return (
          <View
            key={order.salesOrderId}
            style={[styles.orderCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <View style={styles.orderHead}>
              <Text style={[styles.orderNo, { color: colors.text }]} numberOfLines={1}>
                {order.orderNumber ?? order.salesOrderId}
              </Text>
              <Text style={[styles.orderMeta, { color: colors.textMuted }]}>
                {qty != null
                  ? `${qty} ${qty === 1 ? 'item' : 'items'}`
                  : `${order.lines?.length ?? 0} ${(order.lines?.length ?? 0) === 1 ? 'line' : 'lines'}`}
              </Text>
            </View>
            {order.customerName ? (
              <Text style={[styles.customer, { color: colors.textMuted }]} numberOfLines={1}>
                {order.customerName}
              </Text>
            ) : null}
            {order.lines?.length ? (
              order.lines.map((line, index) => {
                const name = itemRowLabel(index, line.productName);
                return (
                  <View
                    key={line.salesOrderLineId}
                    style={[styles.itemRow, { borderTopColor: colors.border }]}
                  >
                    <LineThumb colors={colors} imagePath={line.productImagePath} label={name} />
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                        {name}
                      </Text>
                      {line.productSku ? (
                        <Text style={[styles.itemSku, { color: colors.textMuted }]} numberOfLines={1}>
                          {line.productSku}
                        </Text>
                      ) : null}
                      <Text style={[styles.itemQty, { color: colors.textMuted }]}>
                        Expected {qtyLabel(line.quantity)}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.missing, { color: colors.textMuted }]}>
                Item detail is not on this trip.
              </Text>
            )}
          </View>
        );
      })}

      <Text style={[styles.gapNote, { color: colors.textMuted }]}>
        {delivery
          ? 'Package count and item delivery are not recorded on this trip.'
          : 'Package count is not on this trip.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  section: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  totals: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '600',
  },
  gapNote: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  orderCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderNo: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  customer: {
    fontSize: 11,
    fontWeight: '500',
  },
  orderMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  missing: {
    fontSize: 11,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  thumbEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemSku: {
    fontSize: 10,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 10,
    fontWeight: '500',
  },
});
