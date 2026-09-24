import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DriverMultiOrderJobCard } from '../DriverMultiOrderJobCard';
import { persistStopDeliveryProof } from '../persistStopDeliveryProof';
import { updateTripStatus } from '@pulse/domain/features/trips/services/trips.service';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import type { TripRow } from '@pulse/domain/features/trips/services/trips.service';

const mockUseDriverCommerceMission = jest.fn();

jest.mock('react-native', () => jest.requireActual('react-native'));

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

jest.mock('@pulse/domain/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { uid: 'user-1' } }),
}));

jest.mock('@pulse/domain/features/trips/services/trips.service', () => ({
  updateTripStatus: jest.fn().mockResolvedValue({ error: null, trip: { id: 'trip-1', status: 'completed' } }),
}));

jest.mock('../persistStopDeliveryProof', () => ({
  persistStopDeliveryProof: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../commerce-mission/useDriverCommerceMission', () => ({
  useDriverCommerceMission: (...args: unknown[]) => mockUseDriverCommerceMission(...args),
}));

function trip(): TripRow {
  return { id: 'trip-1' } as TripRow;
}

function stop(
  extras: Partial<DriverStopExecutionStop> & Pick<DriverStopExecutionStop, 'stopId' | 'sequence' | 'stopType' | 'status'>,
): DriverStopExecutionStop {
  return {
    displayName: extras.displayName ?? extras.stopId,
    addressLine: extras.addressLine ?? '2464 Royal Ln',
    city: extras.city ?? 'Mesa',
    state: 'NJ',
    pincode: '45463',
    latitude: null,
    longitude: null,
    contactName: 'Holden',
    contactPhone: extras.contactPhone ?? null,
    podRequired: false,
    driverId: 'drv-1',
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
    ...extras,
  };
}

function execution(overrides: Record<string, unknown>) {
  return {
    tripId: 'trip-1',
    mutating: null,
    hydrated: true,
    arrive: jest.fn().mockResolvedValue({ ok: true }),
    complete: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function missionWithOrders(stopOrders: Array<{ stopId: string; orders: Array<Record<string, unknown>> }>) {
  return {
    status: 'ready',
    mission: {
      tripId: 'trip-1',
      indentId: null,
      executionPlanId: 'plan-1',
      stops: stopOrders.map((s) => ({ stopId: s.stopId, orders: s.orders })),
    },
  };
}

describe('DriverMultiOrderJobCard', () => {
  const pickup = stop({ stopId: 'pu-1', sequence: 1, stopType: 'pickup', status: 'pending', displayName: 'Guindy Warehouse' });
  const dropA = stop({ stopId: 'dr-1', sequence: 2, stopType: 'drop', status: 'pending', displayName: 'Customer A' });
  const dropB = stop({ stopId: 'dr-2', sequence: 3, stopType: 'drop', status: 'pending', displayName: 'Customer B' });

  beforeEach(() => {
    (persistStopDeliveryProof as jest.Mock).mockClear();
    (updateTripStatus as jest.Mock).mockClear();
    (updateTripStatus as jest.Mock).mockResolvedValue({ error: null, trip: { id: 'trip-1', status: 'completed' } });
    mockUseDriverCommerceMission.mockReset();
    mockUseDriverCommerceMission.mockReturnValue(missionWithOrders([
      {
        stopId: 'pu-1',
            orders: [
              { salesOrderId: 'so-1', orderNumber: 'ORD-1042', customerName: 'Holden', lines: [{ salesOrderLineId: 'l1', quantity: 2 }, { salesOrderLineId: 'l2', quantity: 1 }] },
              { salesOrderId: 'so-2', orderNumber: 'ORD-1048', customerName: 'Holden', lines: [{ salesOrderLineId: 'l3', quantity: 4 }] },
            ],
      },
      { stopId: 'dr-1', orders: [{ salesOrderId: 'so-1', orderNumber: 'ORD-1042', customerName: 'Customer A', lines: [{ salesOrderLineId: 'l1', quantity: 2 }] }] },
    ]));
  });

  it('pickup current stop uses Ready to pick up', () => {
    const arrive = jest.fn().mockResolvedValue({ ok: true });
    const { getByLabelText, getAllByText, getByText, queryByLabelText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [pickup, dropA],
          currentStop: pickup,
          nextStop: dropA,
          arrive,
        })}
      />,
    );
    expect(getByText("Today's route")).toBeTruthy();
    expect(getAllByText('Guindy Warehouse').length).toBeGreaterThan(0);
    expect(getByText('ORD-1042')).toBeTruthy();
    expect(getByText('ORD-1048')).toBeTruthy();
    fireEvent.press(getByLabelText('Ready to pick up'));
    expect(arrive).toHaveBeenCalledTimes(1);
    expect(queryByLabelText('Confirm pickup')).toBeNull();
  });

  it('arrived pickup opens verification then Confirm pickup completes the stop', async () => {
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const arrived = { ...pickup, status: 'arrived' as const };
    const { getByLabelText, queryByLabelText, getByText, getByTestId } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [arrived, dropA],
          currentStop: arrived,
          nextStop: dropA,
          complete,
        })}
      />,
    );
    expect(getByText('At pickup')).toBeTruthy();
    fireEvent.press(getByLabelText('Verify pickup'));
    expect(complete).not.toHaveBeenCalled();
    expect(getByTestId('driver-stop-verification')).toBeTruthy();
    expect(getByText('Pickup detail')).toBeTruthy();
    fireEvent.press(getByLabelText('Collected from warehouse'));
    fireEvent.press(getByLabelText('Confirm pickup'));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(persistStopDeliveryProof).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pickup', stopId: 'pu-1' }),
    );
    expect(queryByLabelText('Ready to pick up')).toBeNull();
  });

  it('delivery current stop uses Ready to deliver', () => {
    const arrive = jest.fn().mockResolvedValue({ ok: true });
    const { getByLabelText, getAllByText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [{ ...pickup, status: 'completed' }, dropA],
          currentStop: dropA,
          nextStop: null,
          arrive,
        })}
      />,
    );
    expect(getAllByText('Delivery').length).toBeGreaterThan(0);
    fireEvent.press(getByLabelText('Ready to deliver'));
    expect(arrive).toHaveBeenCalledTimes(1);
  });

  it('arrived delivery opens verification then Confirm delivery completes the stop', async () => {
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const arrivedDrop = { ...dropA, status: 'arrived' as const };
    const { getByLabelText, queryByLabelText, getByTestId } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [{ ...pickup, status: 'completed' }, arrivedDrop],
          currentStop: arrivedDrop,
          nextStop: null,
          complete,
        })}
      />,
    );
    fireEvent.press(getByLabelText('Verify delivery'));
    expect(complete).not.toHaveBeenCalled();
    expect(getByTestId('driver-stop-verification')).toBeTruthy();
    fireEvent.press(getByLabelText('Handed to recipient'));
    fireEvent.press(getByLabelText('Confirm delivery'));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(queryByLabelText('Ready to deliver')).toBeNull();
  });

  it('hides Call when no phone exists', () => {
    const { queryByLabelText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [pickup, dropA],
          currentStop: pickup,
          nextStop: dropA,
        })}
      />,
    );
    expect(queryByLabelText('Call warehouse')).toBeNull();
    expect(queryByLabelText('Call customer')).toBeNull();
  });

  it('shows Call warehouse when pickup has a phone', () => {
    const withPhone = { ...pickup, contactPhone: '9876543210' };
    const { getByLabelText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [withPhone, dropA],
          currentStop: withPhone,
          nextStop: dropA,
        })}
      />,
    );
    expect(getByLabelText('Call warehouse')).toBeTruthy();
  });

  it('keeps long addresses to two lines and shows Current / Next / Later', () => {
    const longPickup = stop({
      stopId: 'pu-1',
      sequence: 1,
      stopType: 'pickup',
      status: 'pending',
      displayName: 'Guindy Distribution Hub',
      addressLine: 'Plot 12, very long industrial estate road near the inner ring that should wrap',
    });
    const { getByText, getByTestId } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        variant="page"
        edgeToEdge
        collapsed
        stopExecution={execution({
          stops: [longPickup, dropA, dropB],
          currentStop: longPickup,
          nextStop: dropA,
        })}
      />,
    );
    expect(getByTestId('multi-order-route-scan')).toBeTruthy();
    expect(getByText('Current')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();
    expect(getByText('Later')).toBeTruthy();
    expect(getByText('Customer B')).toBeTruthy();
    expect(getByText(/very long industrial estate/)).toBeTruthy();
  });

  it('collapses extra orders at a stop', () => {
    mockUseDriverCommerceMission.mockReturnValue(missionWithOrders([{
      stopId: 'pu-1',
      orders: Array.from({ length: 6 }, (_, i) => ({
        salesOrderId: `so-${i}`,
        orderNumber: `ORD-${i}`,
        customerName: 'Co',
      })),
    }]));
    const { getByText, queryByText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [pickup],
          currentStop: pickup,
          nextStop: null,
        })}
      />,
    );
    expect(getByText('ORD-0')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
    expect(queryByText('ORD-5')).toBeNull();
  });

  it('opens previous stop details without completing', () => {
    const complete = jest.fn().mockResolvedValue({ ok: true });
    const donePickup = { ...pickup, status: 'completed' as const };
    const { getByLabelText, getByTestId, queryByLabelText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [donePickup, dropA],
          currentStop: dropA,
          nextStop: null,
          complete,
        })}
      />,
    );
    fireEvent.press(getByLabelText('View Guindy Warehouse details'));
    expect(getByTestId('driver-stop-verification')).toBeTruthy();
    expect(queryByLabelText('Confirm pickup')).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('opens a full-sheet summary when every stop is done and marks the trip completed', async () => {
    const onTripCompleted = jest.fn();
    const donePickup = { ...pickup, status: 'completed' as const };
    const doneDropA = { ...dropA, status: 'completed' as const };
    const doneDropB = { ...dropB, status: 'completed' as const };
    const { getByTestId, getByLabelText, getByText } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        onTripCompleted={onTripCompleted}
        stopExecution={execution({
          stops: [donePickup, doneDropA, doneDropB],
          currentStop: null,
          nextStop: null,
        })}
      />,
    );
    expect(getByTestId('driver-trip-completion')).toBeTruthy();
    expect(getByText(/deliveries/)).toBeTruthy();
    fireEvent.press(getByLabelText('Mark delivery completed'));
    await waitFor(() => expect(updateTripStatus).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ status: 'completed' }),
    ));
    await waitFor(() => expect(onTripCompleted).toHaveBeenCalledTimes(1));
    expect(getByText('Delivery completed')).toBeTruthy();
  });

  it('does not offer Arrive/Complete when SES is empty even if Primitive A has stops', () => {
    const arrive = jest.fn().mockResolvedValue({ ok: true });
    const complete = jest.fn().mockResolvedValue({ ok: true });
    mockUseDriverCommerceMission.mockReturnValue({
      status: 'ready',
      mission: {
        tripId: 'trip-1',
        indentId: null,
        executionPlanId: 'plan-1',
        stops: [
          {
            stopId: 'plan-pu',
            sequence: 1,
            stopType: 'pickup',
            displayName: 'Warehouse',
            orders: [],
          },
          {
            stopId: 'plan-dr',
            sequence: 2,
            stopType: 'drop',
            displayName: 'Customer',
            orders: [],
          },
        ],
      },
    });
    const { getByText, queryByLabelText, getByTestId } = render(
      <DriverMultiOrderJobCard
        trip={trip()}
        stopExecution={execution({
          stops: [],
          currentStop: null,
          nextStop: null,
          arrive,
          complete,
        })}
      />,
    );
    expect(getByText('Route setup pending')).toBeTruthy();
    expect(getByTestId('multi-order-action-idle')).toBeTruthy();
    expect(queryByLabelText('Ready to pick up')).toBeNull();
    expect(queryByLabelText('Ready to deliver')).toBeNull();
    expect(queryByLabelText('Verify pickup')).toBeNull();
    expect(queryByLabelText('Verify delivery')).toBeNull();
    expect(arrive).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
});
