import {
  ITEM_LEVEL_DELIVERY_PERSISTED,
  expectedQtyLabel,
  itemRowLabel,
  orderExpectedQty,
  stopVerificationTotals,
} from '../stopVerificationSummary';
import type { DriverTripStopOrder } from '../../commerce-mission/driverTripStopOrders.types';

function order(partial: Partial<DriverTripStopOrder> & Pick<DriverTripStopOrder, 'salesOrderId'>): DriverTripStopOrder {
  return {
    orderNumber: null,
    customerId: null,
    customerName: null,
    customerPhone: null,
    attachmentRole: 'drop',
    deliveryWindowStart: null,
    deliveryWindowEnd: null,
    notes: null,
    priority: null,
    orderTotalAmount: null,
    currency: null,
    orderDistinctDropStopCount: 1,
    orderCompletedDropStopCount: 0,
    lines: [],
    ...partial,
  };
}

describe('stopVerificationSummary', () => {
  it('does not claim item-level delivery is persisted', () => {
    expect(ITEM_LEVEL_DELIVERY_PERSISTED).toBe(false);
  });

  it('sums expected quantities across orders and lines', () => {
    const orders = [
      order({
        salesOrderId: 'a',
        orderNumber: '10482',
        lines: [
          { salesOrderLineId: 'l1', quantity: 2 },
          { salesOrderLineId: 'l2', quantity: 1 },
        ],
      }),
      order({
        salesOrderId: 'b',
        lines: [{ salesOrderLineId: 'l3', quantity: 4 }],
      }),
    ];
    expect(stopVerificationTotals(orders)).toEqual({
      orderCount: 2,
      lineCount: 3,
      expectedQty: 7,
    });
    expect(expectedQtyLabel(stopVerificationTotals(orders))).toBe('2 orders · 7 items');
    expect(orderExpectedQty(orders[0]!)).toBe(3);
    expect(itemRowLabel(0)).toBe('Item 1');
    expect(itemRowLabel(0, '  Widget  ')).toBe('Widget');
  });

  it('does not invent quantity when lines have none', () => {
    const orders = [order({ salesOrderId: 'a', lines: [{ salesOrderLineId: 'l1', quantity: null }] })];
    expect(stopVerificationTotals(orders).expectedQty).toBeNull();
    expect(expectedQtyLabel(stopVerificationTotals(orders))).toBe('1 order · 1 line');
  });
});
