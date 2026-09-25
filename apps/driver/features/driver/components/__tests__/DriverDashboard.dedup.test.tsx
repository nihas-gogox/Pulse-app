/**
 * Covers the confirmed DriverDashboard audit finding: fetch() could be
 * triggered independently by the mount effect, useFocusEffect (React
 * Navigation fires focus on initial mount too), and the AppState-active
 * listener, with no in-flight guard. Full-mount test following
 * features/drivers/screens/__tests__/DriverRequestsScreen.dedup.test.tsx.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import DriverDashboard from '../DriverDashboard';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import * as driversService from '@pulse/domain/features/drivers/services/drivers.service';
import * as tripsService from '@pulse/domain/features/trips/services/trips.service';
import * as tripOtpService from '@pulse/domain/features/trips/services/tripOtp.service';

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('@pulse/domain/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@pulse/core/contexts/DriverAvatarContext', () => ({
  useDriverAvatar: () => ({ avatarSeed: null, setAvatarSeed: jest.fn() }),
}));
jest.mock('@pulse/ui/contexts/DriverThemeContext', () => ({
  useDriverTheme: () => ({ isDark: false, mapTheme: 'light', theme: 'light' }),
  useDriverThemeColors: () => new Proxy({}, { get: () => '#000000' }),
}));
jest.mock('@pulse/domain/lib/avatarUpload', () => ({ useDriverAvatarUri: () => ({ avatarUri: null }) }));
jest.mock('../../communication', () => ({
  useDriverCommunication: () => ({ communicationActive: false }),
  useDriverLocationStream: () => undefined,
}));
jest.mock('../../hooks/useDriverMapLivePositionWatch', () => ({
  useDriverMapLivePositionWatch: () => undefined,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native');
  const MapView = (props: { children?: React.ReactNode }) => <RNView {...props} />;
  return {
    __esModule: true,
    default: MapView,
    Marker: RNView,
    Polyline: RNView,
    Callout: RNView,
  };
});
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (C: unknown) => C ?? RNView,
      View: RNView,
    },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedProps: () => ({}),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('@pulse/ui/components/driver/DriverMapAvatarMarker', () => ({ DriverMapAvatarMarker: () => null }));
jest.mock('../../../../components/driver/DriverHeader', () => ({ DriverHeader: () => null }));
jest.mock('../../job-card/DriverJobCard', () => ({ DriverJobCard: () => null }));
jest.mock('@pulse/ui/features/driver/job-card/parts/RoutePlanMapPin', () => ({ RoutePlanMapPin: () => null }));
jest.mock('../../../../components/JobRequestCard', () => ({ JobRequestCard: () => null }));
jest.mock('../../execution/fetchDriverStopExecution', () => ({
  fetchDriverStopExecution: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@pulse/core/lib/routingService', () => ({ getOptimalRoute: jest.fn() }));
jest.mock('@pulse/domain/lib/reverseGeocodePlace.util', () => ({
  reverseGeocodeCityStateLabel: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@pulse/domain/features/driver/services/driverLocation.service', () => ({
  reportDriverLocation: jest.fn(() => Promise.resolve({ error: null })),
}));
jest.mock('@pulse/domain/features/drivers/services/drivers.service', () => ({
  getLinkedDriversForCurrentUser: jest.fn(),
  getDriverInvitesReceived: jest.fn(),
}));
jest.mock('@pulse/domain/features/trips/services/trips.service', () => ({
  getDriverUiTripsByDriverIds: jest.fn(),
  resolveDriverFacingTripLabel: jest.fn((t: { trip_number?: string; id: string }) => t.trip_number ?? t.id),
  driverRejectTrip: jest.fn(),
}));
jest.mock('@pulse/domain/features/trips/services/tripOtp.service', () => ({
  getPendingOtpTrips: jest.fn(),
  claimTripByOtp: jest.fn(),
}));

const mockGetLinkedDrivers = driversService.getLinkedDriversForCurrentUser as jest.Mock;
const mockGetInvites = driversService.getDriverInvitesReceived as jest.Mock;
const mockGetPendingOtp = tripOtpService.getPendingOtpTrips as jest.Mock;
const mockGetTrips = tripsService.getDriverUiTripsByDriverIds as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ profile: { uid: 'user-1' } });
  mockGetLinkedDrivers.mockResolvedValue({ error: null, drivers: [] });
  mockGetInvites.mockResolvedValue({ error: null, invites: [] });
  mockGetPendingOtp.mockResolvedValue({ error: null, trips: [] });
  mockGetTrips.mockResolvedValue({ error: null, trips: [] });
});

describe('DriverDashboard — fetch dedup across mount/focus/AppState', () => {
  it('mount + focus firing together triggers only one underlying request set', async () => {
    render(<DriverDashboard />);

    await waitFor(() => expect(mockGetLinkedDrivers).toHaveBeenCalled());

    expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(1);
    expect(mockGetInvites).toHaveBeenCalledTimes(1);
    expect(mockGetPendingOtp).toHaveBeenCalledTimes(1);
  });

  it('an AppState "active" event arriving while the initial fetch is still in flight joins it, not a second request', async () => {
    let resolveDrivers!: (v: { error: null; drivers: unknown[] }) => void;
    mockGetLinkedDrivers.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDrivers = resolve;
      }),
    );
    const addListenerSpy = jest.spyOn(AppState, 'addEventListener');

    render(<DriverDashboard />);

    const handler = addListenerSpy.mock.calls.find(([type]) => type === 'change')?.[1] as
      | ((state: string) => void)
      | undefined;
    expect(handler).toBeDefined();
    act(() => {
      handler?.('active');
    });

    await act(async () => {
      resolveDrivers({ error: null, drivers: [] });
      await Promise.resolve();
    });

    await waitFor(() => expect(mockGetInvites).toHaveBeenCalled());

    expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(1);
    expect(mockGetInvites).toHaveBeenCalledTimes(1);
    expect(mockGetPendingOtp).toHaveBeenCalledTimes(1);
  });

  it('a refresh started after the in-flight request settles still fetches again (legitimate refresh preserved)', async () => {
    render(<DriverDashboard />);

    await waitFor(() => expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(1));

    const handler = (jest.spyOn(AppState, 'addEventListener') as jest.Mock).mock.calls.find(
      ([type]) => type === 'change',
    )?.[1] as ((state: string) => void) | undefined;
    await act(async () => {
      handler?.('active');
      await Promise.resolve();
    });

    await waitFor(() => expect(mockGetLinkedDrivers).toHaveBeenCalledTimes(2));
    expect(mockGetInvites).toHaveBeenCalledTimes(2);
    expect(mockGetPendingOtp).toHaveBeenCalledTimes(2);
  });
});
