import {
  getLatestDriverLocationForTrip,
  getLatestDriverLocationForTripOrDriver,
  getTripLocationHistory,
  reportDriverLocation,
  resetLocationReadPauseForTests,
  shouldPersistDriverLocation,
} from '@/features/driver/services/driverLocation.service';

const mockGetSession = jest.fn();
const mockInsert = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

const LOCATION = {
  latitude: 13.08,
  longitude: 80.27,
  accuracy: 5,
  recorded_at: '2026-09-25T14:00:00.000Z',
};

function tableChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function baseParams(ownerUserId: string | null) {
  return {
    driverId: 'drv-1',
    organizationId: 'org-1',
    tripId: 'trip-1',
    latitude: 13.08,
    longitude: 80.27,
    source: 'live' as const,
    ownerUserId,
  };
}

describe('shouldPersistDriverLocation', () => {
  it('allows a matching auth uid', () => {
    expect(shouldPersistDriverLocation({ sessionUserId: 'user-a', ownerUserId: 'user-a' })).toBe(true);
  });

  it('skips a mismatched auth uid', () => {
    expect(shouldPersistDriverLocation({ sessionUserId: 'user-b', ownerUserId: 'user-a' })).toBe(false);
  });

  it('stops writes after logout', () => {
    expect(shouldPersistDriverLocation({ sessionUserId: null, ownerUserId: 'user-a' })).toBe(false);
  });
});

describe('reportDriverLocation ownership guard', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockInsert.mockReset();
    mockFrom.mockClear();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('inserts when the live session owns the driver', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
    });
    const result = await reportDriverLocation(baseParams('user-a'));
    expect(result).toEqual({ error: null });
    expect(mockFrom).toHaveBeenCalledWith('driver_locations');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('skips a stale scheduled ping after the session switches user', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-b' } } },
    });
    const result = await reportDriverLocation(baseParams('user-a'));
    expect(result).toEqual({ error: null, skipped: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await reportDriverLocation(baseParams('user-a'));
    expect(result.skipped).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('live location read containment', () => {
  beforeEach(() => {
    resetLocationReadPauseForTests();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));
  });

  it('uses the RPC result and does not read driver_locations', async () => {
    mockRpc.mockResolvedValue({ data: LOCATION, error: null, status: 200 });

    const result = await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');

    expect(result.error).toBeNull();
    expect(result.location).toEqual(LOCATION);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_latest_driver_location_for_trip', {
      p_trip_id: 'trip-1',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('reads driver_locations by trip when the RPC is missing', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Could not find the function public.get_latest_driver_location_for_trip in the schema cache',
        code: 'PGRST202',
      },
      status: 404,
    });
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('driver_locations');
      return tableChain({ data: LOCATION, error: null });
    });

    const result = await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');

    expect(result.error).toBeNull();
    expect(result.location).toEqual(LOCATION);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('driver_locations');
  });

  it('returns a statement timeout without a table fallback and pauses the next poll', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'canceling statement due to statement timeout',
        code: '57014',
      },
      status: 500,
    });

    const failed = await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');

    expect(failed.error?.message).toMatch(/statement timeout/);
    expect(failed.location).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    mockRpc.mockClear();
    const duringPause = await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');
    expect(duringPause.location).toBeNull();
    expect(duringPause.error).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();

    now.mockReturnValue(1_000_000 + 120_000);
    mockRpc.mockResolvedValue({ data: LOCATION, error: null, status: 200 });
    const resumed = await getLatestDriverLocationForTrip('trip-1');
    expect(resumed.location).toEqual(LOCATION);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it('returns HTTP 503 without a table fallback and pauses the next poll', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Service Unavailable', code: '' },
      status: 503,
    });

    const failed = await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');

    expect(failed.error?.message).toBe('Service Unavailable');
    expect(failed.location).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();

    mockRpc.mockClear();
    await getTripLocationHistory('trip-1');
    await getLatestDriverLocationForTrip('trip-1');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('treats the client TimeoutError as a pause and does not fall back', async () => {
    const timeout = new Error('Request timed out');
    timeout.name = 'TimeoutError';
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: `${timeout.name}: ${timeout.message}`, code: '', name: 'TimeoutError' },
      status: 0,
    });

    const failed = await getLatestDriverLocationForTrip('trip-1');

    expect(failed.location).toBeNull();
    expect(failed.error).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();

    mockRpc.mockClear();
    await getLatestDriverLocationForTripOrDriver('trip-1', 'drv-1');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
