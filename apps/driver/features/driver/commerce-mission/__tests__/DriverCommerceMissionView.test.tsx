import { DriverCommerceMissionView } from '../DriverCommerceMissionView';
import type { DriverTripStopOrderMission } from '../driverTripStopOrders.types';
import { render } from '@testing-library/react-native';

jest.mock('react-native', () => jest.requireActual('react-native'));

const mission: DriverTripStopOrderMission = {
  tripId: 'trip-1',
  indentId: 'indent-1',
  executionPlanId: 'plan-1',
  stops: [
    {
      stopId: 'pu-1',
      sequence: 0,
      stopType: 'pickup',
      sourceType: 'warehouse',
      displayName: 'Warehouse',
      label: 'PU',
      addressLine: 'Yard',
      city: 'Chennai',
      state: 'TN',
      pincode: '600001',
      contactName: null,
      contactPhone: null,
      latitude: null,
      longitude: null,
      podRequired: false,
      stopExecutionStatus: 'completed',
      arrivedAt: null,
      completedAt: null,
      failureReason: null,
      stopDistinctDropOrderCount: 0,
      orders: [
        {
          salesOrderId: 'so-1',
          orderNumber: 'SO-1',
          customerId: 'c1',
          customerName: 'ABC Retail',
          customerPhone: '90000',
          attachmentRole: 'pickup',
          deliveryWindowStart: null,
          deliveryWindowEnd: null,
          notes: null,
          priority: 'standard',
          orderTotalAmount: 8500,
          currency: 'INR',
          orderDistinctDropStopCount: 1,
          orderCompletedDropStopCount: 0,
          lines: [{ salesOrderLineId: 'l1', quantity: 4 }],
        },
      ],
    },
    {
      stopId: 'dr-1',
      sequence: 1,
      stopType: 'drop',
      sourceType: 'client',
      displayName: 'Drop A',
      label: 'DR',
      addressLine: 'Shop',
      city: 'Chennai',
      state: 'TN',
      pincode: '600002',
      contactName: null,
      contactPhone: null,
      latitude: null,
      longitude: null,
      podRequired: true,
      stopExecutionStatus: 'pending',
      arrivedAt: null,
      completedAt: null,
      failureReason: null,
      stopDistinctDropOrderCount: 1,
      orders: [
        {
          salesOrderId: 'so-1',
          orderNumber: 'SO-1',
          customerId: 'c1',
          customerName: 'ABC Retail',
          customerPhone: '90000',
          attachmentRole: 'drop',
          deliveryWindowStart: null,
          deliveryWindowEnd: null,
          notes: 'Leave at dock',
          priority: 'standard',
          orderTotalAmount: 8500,
          currency: 'INR',
          orderDistinctDropStopCount: 1,
          orderCompletedDropStopCount: 0,
          lines: [{ salesOrderLineId: 'l1', quantity: 4 }],
        },
      ],
    },
  ],
};

describe('DriverCommerceMissionView', () => {
  it('renders pickup then drop with order details and no action copy', () => {
    const { getByText, getAllByText, queryByText } = render(
      <DriverCommerceMissionView mission={mission} />,
    );
    expect(getByText('Stop 1 — Pickup')).toBeTruthy();
    expect(getByText('Stop 2 — Drop')).toBeTruthy();
    expect(getAllByText('SO-1').length).toBe(2);
    expect(getAllByText('ABC Retail').length).toBe(2);
    expect(getByText('Leave at dock')).toBeTruthy();
    expect(getByText('POD required at this stop')).toBeTruthy();
    expect(queryByText('Arrive')).toBeNull();
    expect(queryByText('Complete')).toBeNull();
    expect(queryByText(/delivered/i)).toBeNull();
  });

  it('does not treat missing plan as a commerce order list', () => {
    const { getByText } = render(
      <DriverCommerceMissionView
        mission={{ tripId: 't', indentId: null, executionPlanId: null, stops: [] }}
      />,
    );
    expect(getByText('This trip has no Commerce order list.')).toBeTruthy();
  });
});
