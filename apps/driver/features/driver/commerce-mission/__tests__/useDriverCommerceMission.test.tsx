import React from 'react';
import { DriverCommerceMissionEntry } from '../DriverCommerceMissionEntry';
import { emptyDriverTripStopOrderMission } from '../normalizeDriverTripStopOrders';
import { useDriverCommerceMission } from '../useDriverCommerceMission';
import type { DriverTripStopOrderMission } from '../driverTripStopOrders.types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native', () => jest.requireActual('react-native'));

const mockFetch = jest.fn();

jest.mock('../fetchDriverTripStopOrders', () => ({
  fetchDriverTripStopOrders: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('@pulse/ui/contexts/DriverThemeContext', () => ({
  useDriverThemeColors: () => ({
    text: '#111',
    textMuted: '#666',
    surface: '#fff',
    borderSubtle: '#ddd',
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function commerceMission(tripId: string): DriverTripStopOrderMission {
  return {
    ...emptyDriverTripStopOrderMission(tripId),
    indentId: 'indent-1',
    executionPlanId: 'plan-1',
  };
}

function DualSameTrip() {
  useDriverCommerceMission('trip-shared');
  useDriverCommerceMission('trip-shared');
  return null;
}

function DualDifferentTrips() {
  useDriverCommerceMission('trip-a');
  useDriverCommerceMission('trip-b');
  return null;
}

function TwoEntriesSameTrip() {
  return (
    <>
      <DriverCommerceMissionEntry tripId="trip-card" />
      <DriverCommerceMissionEntry tripId="trip-card" />
    </>
  );
}

function Disabled() {
  useDriverCommerceMission('trip-off', { enabled: false });
  return null;
}

function mount(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, client };
}

describe('useDriverCommerceMission TanStack dedupe', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('two consumers with the same tripId issue one RPC', async () => {
    mockFetch.mockResolvedValue({ ok: true, mission: commerceMission('trip-shared') });
    const { unmount } = mount(<DualSameTrip />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    unmount();
    expect(mockFetch).toHaveBeenCalledWith('trip-shared');
  });

  it('different tripIds stay independent', async () => {
    mockFetch.mockImplementation(async (tripId: string) => ({
      ok: true,
      mission: commerceMission(tripId),
    }));
    const { unmount } = mount(<DualDifferentTrips />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    unmount();
    const ids = mockFetch.mock.calls.map((c) => c[0]).sort();
    expect(ids).toEqual(['trip-a', 'trip-b']);
  });

  it('two DriverCommerceMissionEntry mounts do not call the RPC', async () => {
    mockFetch.mockResolvedValue({ ok: true, mission: commerceMission('trip-card') });
    const { getAllByTestId, unmount } = mount(<TwoEntriesSameTrip />);
    await waitFor(() => {
      expect(getAllByTestId('commerce-mission-entry')).toHaveLength(2);
    });
    expect(mockFetch).not.toHaveBeenCalled();
    unmount();
  });

  it('Job Card Entry does not fetch for a legacy / non-commerce tripId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      mission: emptyDriverTripStopOrderMission('trip-legacy'),
    });
    const { getByTestId, unmount } = mount(
      <DriverCommerceMissionEntry tripId="trip-legacy" />,
    );
    expect(getByTestId('commerce-mission-entry')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    unmount();
  });

  it('disabled hook does not call the RPC', async () => {
    const { unmount } = mount(<Disabled />);
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
    unmount();
  });
});
