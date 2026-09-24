import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DriverStopVerificationScreen } from '../DriverStopVerificationScreen';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import type { DriverTripStopOrder } from '../../commerce-mission/driverTripStopOrders.types';

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../commerceProductImageUrl', () => ({
  commerceProductImageUrl: (path: string | null | undefined) =>
    path?.trim() ? `https://img.test/${path.trim()}` : null,
}));

jest.mock('../../../../components/driver/DriverTripSheetLayout', () => ({
  TRIP_SHEET_TOP_RADIUS: 16,
}));

jest.mock('@pulse/ui/components/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));

jest.mock('@pulse/ui/contexts/DriverThemeContext', () => {
  const colors = {
    background: '#f8fafc',
    surface: '#fff',
    surfaceElevated: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    textOnPrimary: '#fff',
    primary: '#059669',
    emerald: '#047857',
    emeraldMuted: 'rgba(4,120,87,0.12)',
    emeraldBorder: 'rgba(4,120,87,0.38)',
  };
  return {
    useDriverThemeColors: () => colors,
    getDriverThemeColors: () => colors,
  };
});

function stop(extras: Partial<DriverStopExecutionStop> & Pick<DriverStopExecutionStop, 'stopType'>): DriverStopExecutionStop {
  return {
    stopId: 's1',
    sequence: 2,
    displayName: 'ABC Distribution Centre',
    addressLine: 'Guindy Industrial Estate',
    city: 'Chennai',
    state: 'TN',
    pincode: '600032',
    latitude: null,
    longitude: null,
    contactName: 'Warehouse',
    contactPhone: null,
    podRequired: false,
    status: 'arrived',
    driverId: 'd1',
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
    ...extras,
  };
}

function order(partial: Partial<DriverTripStopOrder> & Pick<DriverTripStopOrder, 'salesOrderId'>): DriverTripStopOrder {
  return {
    orderNumber: 'ORD-10482',
    customerId: null,
    customerName: 'Customer A',
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
    lines: [{ salesOrderLineId: 'l1', quantity: 2 }],
    ...partial,
  };
}

describe('DriverStopVerificationScreen', () => {
  it('shows pickup expected items without inventing product names or packages', () => {
    const onConfirm = jest.fn();
    const { getByText, queryByText, getByLabelText } = render(
      <DriverStopVerificationScreen
        stop={stop({ stopType: 'pickup' })}
        orders={[
          order({
            salesOrderId: 'a',
            lines: [
              { salesOrderLineId: 'l1', quantity: 2 },
              { salesOrderLineId: 'l2', quantity: 1 },
            ],
          }),
        ]}
        stopIndex={2}
        stopTotal={4}
        ordersLoading={false}
        loadError={null}
        busy={false}
        confirmed={false}
        nextStop={null}
        onBack={jest.fn()}
        onConfirm={onConfirm}
        onViewNextStop={jest.fn()}
      />,
    );
    expect(getByText('Pickup')).toBeTruthy();
    expect(getByText(/Stop 2 of 4/)).toBeTruthy();
    expect(getByText('ABC Distribution Centre')).toBeTruthy();
    expect(getByText('Item 1')).toBeTruthy();
    expect(getByText('Expected 2 ×')).toBeTruthy();
    expect(queryByText('Delivered: 2')).toBeNull();
    expect(queryByText('3 packages')).toBeNull();
    expect(getByText('Proof of pickup')).toBeTruthy();
    expect(getByLabelText('Capture proof with camera')).toBeTruthy();
    expect(getByLabelText('Attach proof photo')).toBeTruthy();
    expect(getByLabelText('Confirm pickup').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByLabelText('Confirm pickup'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText('Collected from warehouse'));
    fireEvent.press(getByLabelText('Confirm pickup'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows delivery expected quantities and refuses fake delivered counts', () => {
    const onConfirm = jest.fn();
    const { getByText, queryByText, getByTestId, getByLabelText } = render(
      <DriverStopVerificationScreen
        stop={stop({ stopType: 'drop', displayName: 'Customer A' })}
        orders={[
          order({
            salesOrderId: 'a',
            lines: [{ salesOrderLineId: 'l1', quantity: 2 }],
          }),
          order({
            salesOrderId: 'b',
            orderNumber: 'ORD-10491',
            customerName: 'Customer A',
            lines: [{ salesOrderLineId: 'l2', quantity: 1 }],
          }),
        ]}
        stopIndex={3}
        stopTotal={4}
        ordersLoading={false}
        loadError={null}
        busy={false}
        confirmed={false}
        nextStop={null}
        onBack={jest.fn()}
        onConfirm={onConfirm}
        onViewNextStop={jest.fn()}
      />,
    );
    expect(getByText('Delivery')).toBeTruthy();
    expect(getByTestId('delivery-completion-summary')).toBeTruthy();
    expect(getByText(/completes this stop, not each item/)).toBeTruthy();
    expect(queryByText('2 / 3 items delivered')).toBeNull();
    expect(queryByText('NOT DELIVERED')).toBeNull();
    expect(getByLabelText('Confirm delivery').props.accessibilityState?.disabled).toBe(true);
    expect(getByLabelText('Capture proof with camera')).toBeTruthy();
    expect(getByLabelText('Attach proof photo')).toBeTruthy();
    fireEvent.press(getByLabelText('Confirm delivery'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText('Handed to recipient'));
    fireEvent.press(getByLabelText('Confirm delivery'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('degrades when item lines are missing', () => {
    const { getByText } = render(
      <DriverStopVerificationScreen
        stop={stop({ stopType: 'pickup' })}
        orders={[order({ salesOrderId: 'a', lines: [] })]}
        stopIndex={1}
        stopTotal={1}
        ordersLoading={false}
        loadError={null}
        busy={false}
        confirmed={false}
        nextStop={null}
        onBack={jest.fn()}
        onConfirm={jest.fn()}
        onViewNextStop={jest.fn()}
      />,
    );
    expect(getByText('Item detail is not on this trip.')).toBeTruthy();
  });

  it('shows commerce catalog name and image when inventory fields are present', () => {
    const { getByText, getByTestId, queryByText } = render(
      <DriverStopVerificationScreen
        stop={stop({ stopType: 'drop' })}
        orders={[
          order({
            salesOrderId: 'a',
            lines: [
              {
                salesOrderLineId: 'l1',
                quantity: 1,
                productName: 'Nvidia GPU kit',
                productSku: 'NV-A',
                productImagePath: 'product-images/org/p.jpg',
              },
            ],
          }),
        ]}
        stopIndex={3}
        stopTotal={4}
        ordersLoading={false}
        loadError={null}
        busy={false}
        confirmed={false}
        nextStop={null}
        onBack={jest.fn()}
        onConfirm={jest.fn()}
        onViewNextStop={jest.fn()}
      />,
    );
    expect(getByText('Nvidia GPU kit')).toBeTruthy();
    expect(getByText('NV-A')).toBeTruthy();
    expect(queryByText('Item 1')).toBeNull();
    expect(getByTestId('stop-verification-item-image')).toBeTruthy();
  });

  it('shows next stop after confirmation without allowing a second confirm', () => {
    const onConfirm = jest.fn();
    const next = stop({ stopId: 's2', stopType: 'drop', displayName: 'Customer B', sequence: 3 });
    const { getByLabelText, queryByLabelText, getByText } = render(
      <DriverStopVerificationScreen
        stop={stop({ stopType: 'pickup' })}
        orders={[order({ salesOrderId: 'a' })]}
        stopIndex={2}
        stopTotal={4}
        ordersLoading={false}
        loadError={null}
        busy={false}
        confirmed
        nextStop={next}
        onBack={jest.fn()}
        onConfirm={onConfirm}
        onViewNextStop={jest.fn()}
      />,
    );
    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('Customer B')).toBeTruthy();
    expect(queryByLabelText('Confirm pickup')).toBeNull();
    expect(getByLabelText('View next stop')).toBeTruthy();
  });
});
