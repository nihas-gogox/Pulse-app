/**
 * Covers the getQueryData ?? rawServiceCall anti-pattern fix (2026-09-16 DB incident
 * class): a cold cache must not let this hook fire its own get_trips_for_org call
 * independently of a concurrently-mounting consumer of the same query key — both
 * should share one request via queryClient.ensureQueryData, mirroring the already-
 * fixed sibling in features/clients/hooks/useClientAnalyticsData.ts.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useDriverAnalyticsData } from '../useDriverAnalyticsData';
import { useOrganization } from '@/contexts/OrganizationContext';
import * as driversService from '@/features/drivers/services/drivers.service';
import * as tripsService from '@/features/trips/services/trips.service';
import { queryKeys } from '@/lib/queryKeys';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/contexts/OrganizationContext', () => ({ useOrganization: jest.fn() }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('@/features/drivers/services/drivers.service', () => ({
  getDriverDetailBundle: jest.fn(),
  getDriverOffersByOrganization: jest.fn(),
}));
jest.mock('@/features/trips/services/trips.service', () => ({
  getTripsForOrg: jest.fn(),
}));

const mockGetDriverDetailBundle = driversService.getDriverDetailBundle as jest.Mock;
const mockGetDriverOffers = driversService.getDriverOffersByOrganization as jest.Mock;
const mockGetTripsForOrg = tripsService.getTripsForOrg as jest.Mock;

const ORG_ID = 'org-1';

function driverBundle() {
  return {
    error: null,
    driver: { id: 'driver-1', name: 'Test Driver', phone: '9999999999' },
    ratings: [],
    salaryRequests: [],
    transactions: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (useOrganization as jest.Mock).mockReturnValue({
    currentOrganization: { id: ORG_ID },
  });
  mockGetDriverDetailBundle.mockResolvedValue(driverBundle());
  mockGetDriverOffers.mockResolvedValue({ error: null, offersByDriverId: {} });
  mockGetTripsForOrg.mockResolvedValue({ error: null, trips: [] });
});

function renderWithClient(ui: () => unknown, client: QueryClient) {
  return renderHook(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe('useDriverAnalyticsData — trips request dedup', () => {
  it('does not call getTripsForOrg when the trips query key is already cached', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.trips.finite(ORG_ID), [{ id: 'trip-1' }]);

    const { result } = renderWithClient(() => useDriverAnalyticsData('driver-1'), client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetTripsForOrg).not.toHaveBeenCalled();
  });

  it('shares one in-flight getTripsForOrg call with a concurrent consumer of the same query key', async () => {
    const client = new QueryClient();
    let resolveTrips!: (v: { error: null; trips: unknown[] }) => void;
    mockGetTripsForOrg.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTrips = resolve;
      }),
    );

    // A second, independent consumer of the exact same query key (e.g. the Trips
    // tab's own useTripsQuery) mounted concurrently — before the fix, this hook's
    // raw `getTripsForOrg` fallback would have fired its own second RPC instead of
    // joining this in-flight one.
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

    const { result } = renderWithClient(() => useDriverAnalyticsData('driver-1'), client);

    await waitFor(() => expect(mockGetTripsForOrg).toHaveBeenCalledTimes(1));

    resolveTrips({ error: null, trips: [] });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(other.result.current.isSuccess).toBe(true));

    expect(mockGetTripsForOrg).toHaveBeenCalledTimes(1);
  });

  it('still calls getTripsForOrg exactly once on a genuine cold cache with no concurrent consumer', async () => {
    const client = new QueryClient();

    const { result } = renderWithClient(() => useDriverAnalyticsData('driver-1'), client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetTripsForOrg).toHaveBeenCalledTimes(1);
    expect(result.current.driver?.name).toBe('Test Driver');
  });

  it('surfaces a trips fetch error via the existing error state', async () => {
    const client = new QueryClient();
    mockGetTripsForOrg.mockResolvedValue({ error: new Error('boom'), trips: [] });

    const { result } = renderWithClient(() => useDriverAnalyticsData('driver-1'), client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('boom');
  });
});
