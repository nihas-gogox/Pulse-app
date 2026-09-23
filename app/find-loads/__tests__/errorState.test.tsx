/**
 * Marketplace Loads: search-first. RPC only runs after from / to / vehicle.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FindLoadsScreen from '../index';
import * as findLoadsForOrgService from '@/features/network/services/findLoadsForOrg.service';
import * as vehiclesService from '@/features/vehicles/services/vehicles.service';

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => false, back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/lib/layoutInsets', () => ({
  useLayoutInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0, isDesktopWeb: false }),
}));
jest.mock('@/lib/useMemberAccess', () => ({
  useMemberAccess: () => ({ can: () => true, isLoading: false }),
}));
const mockUseOptionalOrganization = jest.fn(() => ({
  currentOrganization: { id: 'org-1' },
  isLoading: false,
}));
jest.mock('@/contexts/OrganizationContext', () => ({
  useOptionalOrganization: () => mockUseOptionalOrganization(),
}));

jest.mock('@/features/network/services/findLoadsForOrg.service', () => {
  const actual = jest.requireActual('@/features/network/services/findLoadsForOrg.service');
  return {
    ...actual,
    listOpenMarketplaceLoadsForOrg: jest.fn(),
    listOpenMarketplaceLoadsPage: jest.fn(),
    listMarketplaceSearchLanes: jest.fn().mockResolvedValue({
      error: null,
      lanes: [
        {
          pickup_area: "Bhandara",
          drop_location: "Bengaluru",
          vehicle_type: "40 FT",
          load_count: 3,
        },
      ],
    }),
    listMyOrgMarketBids: jest.fn().mockResolvedValue({ error: null, bids: [] }),
    submitOrgMarketBid: jest.fn(),
  };
});
jest.mock('@/features/vehicles/services/vehicles.service', () => ({
  getVehiclesByOrganization: jest.fn().mockResolvedValue({ error: null, vehicles: [] }),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FindLoadsScreen />
    </QueryClientProvider>,
  );
}

async function applySearch(utils: ReturnType<typeof renderScreen>) {
  fireEvent.press(await utils.findByLabelText('Pickup city'));
  fireEvent.press(await utils.findByLabelText('Pickup Bhandara, 3 available'));
  fireEvent.press(await utils.findByLabelText('Drop Bengaluru, 3 available'));
  fireEvent.press(await utils.findByLabelText('Vehicle 40 FT, 3 available'));
}

describe('Find Loads (organization) — search-first marketplace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOptionalOrganization.mockReturnValue({
      currentOrganization: { id: 'org-1' },
      isLoading: false,
    });
    (vehiclesService.getVehiclesByOrganization as jest.Mock).mockResolvedValue({
      error: null,
      vehicles: [],
    });
    (findLoadsForOrgService.listMyOrgMarketBids as jest.Mock).mockResolvedValue({
      error: null,
      bids: [],
    });
  });

  it('does not call the marketplace RPC until the user searches', async () => {
    const { findByLabelText } = renderScreen();
    expect(await findByLabelText('Pickup city')).toBeTruthy();
    expect(await findByLabelText('Drop city')).toBeTruthy();
    expect(await findByLabelText('Vehicle type')).toBeTruthy();
    expect(findLoadsForOrgService.listOpenMarketplaceLoadsPage).not.toHaveBeenCalled();
  });

  it('shows the error state with Retry when the RPC fails after search', async () => {
    (findLoadsForOrgService.listOpenMarketplaceLoadsPage as jest.Mock).mockResolvedValue({
      error: new Error('permission denied for function list_open_marketplace_loads_for_org'),
      loads: [],
      hasMore: false,
      nextOffset: undefined,
    });
    const screen = renderScreen();
    await applySearch(screen);

    await waitFor(() =>
      expect(screen.findByText("Couldn't load Marketplace loads.")).resolves.toBeTruthy(),
    );
    expect(screen.queryByText('No Marketplace loads on this route.')).toBeNull();
    expect(await screen.findByText('Retry')).toBeTruthy();
  });

  it('tapping Retry refetches the same search', async () => {
    (findLoadsForOrgService.listOpenMarketplaceLoadsPage as jest.Mock).mockResolvedValue({
      error: new Error('network error'),
      loads: [],
      hasMore: false,
      nextOffset: undefined,
    });
    const screen = renderScreen();
    await applySearch(screen);
    await waitFor(() =>
      expect(screen.findByText("Couldn't load Marketplace loads.")).resolves.toBeTruthy(),
    );

    const callsBeforeRetry = (findLoadsForOrgService.listOpenMarketplaceLoadsPage as jest.Mock).mock
      .calls.length;
    fireEvent.press(await screen.findByText('Retry'));

    await waitFor(() =>
      expect(
        (findLoadsForOrgService.listOpenMarketplaceLoadsPage as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(callsBeforeRetry),
    );
  });

  it('a successful search with zero loads shows route empty copy, never the error copy', async () => {
    (findLoadsForOrgService.listOpenMarketplaceLoadsPage as jest.Mock).mockResolvedValue({
      error: null,
      loads: [],
      hasMore: false,
      nextOffset: undefined,
    });
    const screen = renderScreen();
    await applySearch(screen);

    await waitFor(() =>
      expect(screen.findByText('No Marketplace loads on this route.')).resolves.toBeTruthy(),
    );
    expect(screen.queryByText("Couldn't load Marketplace loads.")).toBeNull();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('does not throw when OrganizationProvider is missing', () => {
    mockUseOptionalOrganization.mockReturnValue(undefined as never);
    expect(() => renderScreen()).not.toThrow();
  });
});
