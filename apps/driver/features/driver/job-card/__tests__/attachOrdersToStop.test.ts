import {
  completedStopCount,
  distinctOrderCount,
  ordersOnStop,
} from '../attachOrdersToStop';
import { emptyDriverTripStopOrderMission } from '../../commerce-mission/normalizeDriverTripStopOrders';
import type { DriverTripStopOrderMission } from '../../commerce-mission/driverTripStopOrders.types';

function mission(): DriverTripStopOrderMission {
  return {
    ...emptyDriverTripStopOrderMission('trip-1'),
    executionPlanId: 'plan-1',
    stops: [
      {
        stopId: 'pickup-1',
        sequence: 1,
        stopType: 'pickup',
        sourceType: null,
        displayName: 'WH',
        label: null,
        addressLine: null,
        city: 'Chennai',
        state: null,
        pincode: null,
        contactName: null,
        contactPhone: null,
        latitude: null,
        longitude: null,
        podRequired: false,
        stopExecutionStatus: 'pending',
        arrivedAt: null,
        completedAt: null,
        failureReason: null,
        stopDistinctDropOrderCount: 2,
        orders: [
          {
            salesOrderId: 'so-a',
            orderNumber: 'SO-A',
            customerId: null,
            customerName: 'Order A',
            customerPhone: null,
            attachmentRole: 'pickup',
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            notes: null,
            priority: null,
            orderTotalAmount: null,
            currency: null,
            orderDistinctDropStopCount: 1,
            orderCompletedDropStopCount: 0,
            lines: [],
          },
          {
            salesOrderId: 'so-b',
            orderNumber: 'SO-B',
            customerId: null,
            customerName: 'Order B',
            customerPhone: null,
            attachmentRole: 'pickup',
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            notes: null,
            priority: null,
            orderTotalAmount: null,
            currency: null,
            orderDistinctDropStopCount: 1,
            orderCompletedDropStopCount: 0,
            lines: [],
          },
        ],
      },
      {
        stopId: 'drop-a',
        sequence: 2,
        stopType: 'drop',
        sourceType: null,
        displayName: 'Customer A',
        label: null,
        addressLine: null,
        city: null,
        state: null,
        pincode: null,
        contactName: null,
        contactPhone: null,
        latitude: null,
        longitude: null,
        podRequired: false,
        stopExecutionStatus: 'pending',
        arrivedAt: null,
        completedAt: null,
        failureReason: null,
        stopDistinctDropOrderCount: 1,
        orders: [
          {
            salesOrderId: 'so-a',
            orderNumber: 'SO-A',
            customerId: null,
            customerName: 'Order A',
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
          },
        ],
      },
    ],
  };
}

describe('attachOrdersToStop', () => {
  it('returns orders for the current stop only', () => {
    const m = mission();
    expect(ordersOnStop(m, 'pickup-1').map((o) => o.orderNumber)).toEqual(['SO-A', 'SO-B']);
    expect(ordersOnStop(m, 'drop-a').map((o) => o.orderNumber)).toEqual(['SO-A']);
    expect(ordersOnStop(m, 'missing')).toEqual([]);
  });

  it('counts distinct orders across stops', () => {
    expect(distinctOrderCount(mission())).toBe(2);
    expect(distinctOrderCount(emptyDriverTripStopOrderMission('x'))).toBe(0);
  });

  it('counts completed and skipped stops', () => {
    expect(completedStopCount([
      { status: 'completed' },
      { status: 'pending' },
      { status: 'skipped' },
    ])).toBe(2);
  });
});
