/**
 * Fleet ops must reuse queryKeys.trips.finite instead of a second
 * get_trips_for_org catalog fetch (30s poll of up to 400 fat rows).
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFleetOperationsQuery } from '../useFleetOperationsQuery';
import * as tripsService from '@/features/trips/services/trips.service';
import { queryKeys } from '@/lib/queryKeys';

jest.mock('@/lib/queries/useTripsQuery', () => ({
  useTripsQuery: (orgId: string | null) => {
    const { useQuery } = require('@tanstack/react-query');
    const { queryKeys } = require('@/lib/queryKeys');
    const { getTripsForOrg } = require('@/features/trips/services/trips.service');
    return useQuery({
      queryKey: queryKeys.trips.finite(orgId ?? ''),
      queryFn: async () => {
        const res = await getTripsForOrg(orgId!);
        if (res.error) throw res.error;
        return res.trips;
      },
      enabled: !!orgId,
      staleTime: 5 * 60_000,
      refetchOnMount: false,
    });
  },
}));

jest.mock('@/features/trips/services/trips.service', () => ({
  getTripsForOrg: jest.fn(),
}));

jest.mock('@/features/tracking/services/driverPresence.service', () => ({
  getDriverPresenceForTrips: jest.fn(async () => ({
    presenceByTripId: new Map(),
    error: null,
  })),
}));

jest.mock('@/features/drivers/services/drivers.service', () => ({
  getDriverPhonesByIds: jest.fn(async () => ({
    phoneByDriverId: new Map(),
    error: null,
  })),
}));

jest.mock('@/features/tracking/services/trackingCheckpoint.service', () => ({
  getCheckpointDistanceSumsForTrips: jest.fn(async () => ({
    distanceMByTripId: new Map(),
    error: null,
  })),
}));

const mockGetTripsForOrg = tripsService.getTripsForOrg as jest.Mock;

const ORG_ID = 'org-fleet-1';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithClient(ui: () => unknown, client: QueryClient) {
  return renderHook(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTripsForOrg.mockResolvedValue({ error: null, trips: [] });
});

describe('useFleetOperationsQuery — trips catalog dedup', () => {
  it('does not call getTripsForOrg when trips.finite is already cached', async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.trips.finite(ORG_ID), [
      { id: 'trip-1', status: 'completed', trip_number: 'T1' },
    ]);

    const { result, unmount } = renderWithClient(() => useFleetOperationsQuery(ORG_ID), client);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetTripsForOrg).not.toHaveBeenCalled();
    expect(result.current.trips).toEqual([]);
    unmount();
  });

  it('shares one in-flight getTripsForOrg call with a concurrent trips.finite consumer', async () => {
    const client = makeClient();
    let resolveTrips!: (v: { error: null; trips: unknown[] }) => void;
    mockGetTripsForOrg.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTrips = resolve;
      }),
    );

    const other = renderWithClient(
      () =>
        useQuery({
          queryKey: queryKeys.trips.finite(ORG_ID),
          queryFn: async () => {
            const res = await tripsService.getTripsForOrg(ORG_ID);
            if (res.error) throw res.error;
            return res.trips;
          },
        }),
      client,
    );

    const fleet = renderWithClient(() => useFleetOperationsQuery(ORG_ID), client);

    resolveTrips({ error: null, trips: [] });

    await waitFor(() => expect(other.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(fleet.result.current.isLoading).toBe(false));

    expect(mockGetTripsForOrg).toHaveBeenCalledTimes(1);
    other.unmount();
    fleet.unmount();
  });
});
