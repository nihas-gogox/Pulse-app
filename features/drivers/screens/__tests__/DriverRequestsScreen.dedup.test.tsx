/**
 * Covers the P2 #2 audit finding: DriverRequestsScreen's fetch() could be
 * triggered independently by the mount effect, useFocusEffect (React
 * Navigation fires focus on initial mount too), and the AppState-active
 * listener, firing duplicate/overlapping Promise.all RPC calls. Full-mount
 * test following this repo's existing pattern in
 * features/drivers/screens/__tests__/DriverProfileScreen.realtime.test.tsx.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import DriverRequestsScreen from '../DriverRequestsScreen';
import { useAuth } from '@/contexts/AuthContext';
import * as driversService from '@/features/drivers/services/drivers.service';
import * as tripsService from '@/features/trips/services/trips.service';

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/contexts/DriverThemeContext', () => ({
  useDriverTheme: () => ({ theme: 'light' }),
  useDriverThemeColors: () => new Proxy({}, { get: () => '#000000' }),
}));
jest.mock('@/lib/avatarUpload', () => ({ useDriverAvatarUri: () => ({ avatarUri: null }) }));
jest.mock('@/lib/hooks/useOrgBrandingByIds', () => ({ useOrgBrandingByIds: () => ({}) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');
// Real useFocusEffect runs its callback as an effect on focus — React
// Navigation fires this on initial mount too, which is exactly the
// concurrent-trigger scenario under test, so mirror that timing here
// instead of no-op'ing it.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // require() here, not the top-level React import: jest.mock factories
    // cannot reference out-of-scope variables.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, [cb]);
  },
}));

jest.mock('@/features/drivers/services/drivers.service', () => ({
  getDriverInvitesReceived: jest.fn(),
  getLinkedDriversForCurrentUser: jest.fn(),
  getDriverUiTripsByDriverIds: jest.fn(),
  getDriverLedgerByDriverIds: jest.fn(),
  rejectDriverInvite: jest.fn(),
  acceptDriverInvite: jest.fn(),
  leaveFleet: jest.fn(),
}));
jest.mock('@/features/trips/services/trips.service', () => ({
  getDriverUiTripsByDriverIds: jest.fn(),
}));

const mockGetInvites = driversService.getDriverInvitesReceived as jest.Mock;
const mockGetLinkedDrivers = driversService.getLinkedDriversForCurrentUser as jest.Mock;
const mockGetTrips = tripsService.getDriverUiTripsByDriverIds as jest.Mock;
const mockGetLedger = driversService.getDriverLedgerByDriverIds as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ profile: { uid: 'user-1' } });
  mockGetInvites.mockResolvedValue({ error: null, invites: [] });
  mockGetLinkedDrivers.mockResolvedValue({ error: null, drivers: [] });
  mockGetTrips.mockResolvedValue({ error: null, trips: [] });
  mockGetLedger.mockResolvedValue({ error: null, entries: [] });
});

describe('DriverRequestsScreen — fetch dedup across mount/focus/AppState', () => {
  it('mount + focus firing together triggers only one underlying request set', async () => {
    render(<DriverRequestsScreen />);

    await waitFor(() => expect(mockGetInvites).toHaveBeenCalled());

    // Both the mount effect and the (mocked, focus-on-mount) useFocusEffect
    // ran during the same commit — before the fix this fired two independent
    // Promise.all([getDriverInvitesReceived(), getLinkedDriversForCurrentUser()]).
    expect(mockGetInvites).toHaveBeenCalledTimes(1);
    expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(1);
  });

  it('an AppState "active" event arriving while the initial fetch is still in flight joins it, not a second request', async () => {
    let resolveInvites!: (v: { error: null; invites: unknown[] }) => void;
    mockGetInvites.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvites = resolve;
      }),
    );
    const addListenerSpy = jest.spyOn(AppState, 'addEventListener');

    render(<DriverRequestsScreen />);

    // Fire the AppState 'active' handler while the mount/focus-triggered
    // fetch is still unresolved.
    const handler = addListenerSpy.mock.calls.find(([type]) => type === 'change')?.[1] as
      | ((state: string) => void)
      | undefined;
    expect(handler).toBeDefined();
    act(() => {
      handler?.('active');
    });

    await act(async () => {
      resolveInvites({ error: null, invites: [] });
      await Promise.resolve();
    });

    await waitFor(() => expect(mockGetLinkedDrivers).toHaveBeenCalled());

    expect(mockGetInvites).toHaveBeenCalledTimes(1);
    expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(1);
  });

  it('a refresh started after the in-flight request settles still fetches again (legitimate refresh preserved)', async () => {
    render(<DriverRequestsScreen />);

    await waitFor(() => expect(mockGetInvites).toHaveBeenCalledTimes(1));

    // Simulate a subsequent, genuinely separate trigger (e.g. pull-to-refresh)
    // once the first request has fully settled — this must still fetch again.
    const handler = (jest.spyOn(AppState, 'addEventListener') as jest.Mock).mock.calls.find(
      ([type]) => type === 'change',
    )?.[1] as ((state: string) => void) | undefined;
    await act(async () => {
      handler?.('active');
      await Promise.resolve();
    });

    await waitFor(() => expect(mockGetInvites).toHaveBeenCalledTimes(2));
    expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(2);
  });
});
