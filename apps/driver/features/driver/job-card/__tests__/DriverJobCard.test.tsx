import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DriverJobCard } from '../DriverJobCard';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import type { TripRow } from '@pulse/domain/features/trips/services/trips.service';

const mockUseDriverStopExecution = jest.fn();
const mockUseDriverCommerceMission = jest.fn();

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('../../../../components/driver/DriverTripSheetLayout', () => ({
  FLOW_EMERALD: '#059669',
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

jest.mock('../../hooks/useDriverStopExecution', () => ({
  useDriverStopExecution: (...args: unknown[]) => mockUseDriverStopExecution(...args),
}));

jest.mock('../../components/DriverTripFlowCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const { View } = require('react-native');
  return { DriverTripFlowCard: () => <View testID="legacy-job-card" /> };
});

jest.mock('../../commerce-mission/useDriverCommerceMission', () => ({
  useDriverCommerceMission: (...args: unknown[]) => mockUseDriverCommerceMission(...args),
}));

jest.mock('@pulse/domain/features/trips/services/trips.service', () => ({
  resolveDriverFacingTripLabel: () => 'TRP001',
}));

function trip(): TripRow {
  return { id: 'trip-1' } as TripRow;
}

function stop(stopId: string): DriverStopExecutionStop {
  return {
    stopId,
    sequence: 1,
    stopType: 'pickup',
    displayName: 'Chennai Warehouse',
    addressLine: null,
    city: 'Chennai',
    state: null,
    pincode: null,
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    podRequired: false,
    status: 'pending',
    driverId: null,
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
  };
}

function controller(overrides: Record<string, unknown>) {
  return {
    tripId: 'trip-1',
    stops: [],
    currentStop: null,
    nextStop: null,
    mutating: null,
    hydrated: true,
    arrive: jest.fn(),
    complete: jest.fn(),
    ...overrides,
  };
}

describe('DriverJobCard', () => {
  beforeEach(() => {
    mockUseDriverStopExecution.mockReset();
    mockUseDriverCommerceMission.mockReset();
    mockUseDriverCommerceMission.mockReturnValue({
      status: 'ready',
      mission: { tripId: 'trip-1', indentId: null, executionPlanId: null, stops: [] },
    });
  });

  it('does not fetch Commerce RPC while SES is still hydrating', () => {
    mockUseDriverStopExecution.mockReturnValue(controller({ hydrated: false }));
    const { getByTestId } = render(<DriverJobCard trip={trip()} />);
    expect(getByTestId('driver-job-card-pending')).toBeTruthy();
    expect(mockUseDriverCommerceMission).not.toHaveBeenCalled();
  });

  it('renders the untouched legacy card when SES is empty and trip is not commerce', () => {
    mockUseDriverStopExecution.mockReturnValue(controller({ hydrated: true, stops: [] }));
    const { getByTestId, queryByTestId } = render(<DriverJobCard trip={trip()} />);
    expect(getByTestId('legacy-job-card')).toBeTruthy();
    expect(queryByTestId('driver-multi-order-job-card')).toBeNull();
    expect(mockUseDriverCommerceMission).not.toHaveBeenCalled();
  });

  it('does not use Primitive A to choose the card when SES is empty', () => {
    mockUseDriverStopExecution.mockReturnValue(controller({ hydrated: true, stops: [] }));
    mockUseDriverCommerceMission.mockReturnValue({
      status: 'ready',
      mission: {
        tripId: 'trip-1',
        indentId: 'indent-1',
        executionPlanId: 'plan-1',
        stops: [],
      },
    });
    const { getByTestId } = render(<DriverJobCard trip={trip()} />);
    expect(getByTestId('legacy-job-card')).toBeTruthy();
    expect(mockUseDriverCommerceMission).not.toHaveBeenCalled();
  });

  it('renders multi-order when trip.is_commerce even without SES', () => {
    mockUseDriverStopExecution.mockReturnValue(controller({ hydrated: true, stops: [] }));
    const { getByTestId, queryByTestId } = render(
      <DriverJobCard trip={{ ...trip(), is_commerce: true }} />,
    );
    expect(getByTestId('driver-multi-order-job-card')).toBeTruthy();
    expect(queryByTestId('legacy-job-card')).toBeNull();
  });

  it('renders the multi-order card and then hydrates Primitive A', async () => {
    const current = stop('s1');
    mockUseDriverStopExecution.mockReturnValue(controller({
      hydrated: true,
      stops: [current],
      currentStop: current,
    }));
    const { getByTestId, queryByTestId } = render(<DriverJobCard trip={trip()} />);
    expect(getByTestId('driver-multi-order-job-card')).toBeTruthy();
    expect(queryByTestId('legacy-job-card')).toBeNull();
    await waitFor(() => {
      expect(mockUseDriverCommerceMission).toHaveBeenCalledWith('trip-1');
    });
  });
});
