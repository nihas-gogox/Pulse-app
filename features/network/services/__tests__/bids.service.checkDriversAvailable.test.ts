/**
 * Covers the checkDriversAvailable audit finding: one is_driver_available RPC
 * per driver fired via an unbounded Promise.all over the full pending-bid
 * driver list. Bounded to DRIVER_AVAILABILITY_CONCURRENCY (3) via the
 * existing runWithConcurrencyLimit helper (features/trips/services/
 * tripDocumentLrPod.service.ts), already used for the same class of fan-out
 * elsewhere in this repo. These tests cover only the concurrency-limiting
 * behavior and the preserved result/error semantics — not a claim about the
 * production DB incident.
 */
jest.mock('@/lib/supabase', () => ({
  supabase: () => ({ rpc: mockRpc }),
}));

const mockRpc = jest.fn();

import { checkDriversAvailable } from '../bids.service';

/** Tracks the maximum number of concurrently in-flight calls to a mocked async fn. */
function trackConcurrency<T>(impl: (...args: unknown[]) => Promise<T>) {
  let active = 0;
  let max = 0;
  const fn = jest.fn(async (...args: unknown[]) => {
    active++;
    max = Math.max(max, active);
    try {
      return await impl(...args);
    } finally {
      active--;
    }
  });
  return { fn, getMax: () => max };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkDriversAvailable — bounded concurrency', () => {
  it('never runs more than 3 is_driver_available RPC calls concurrently, and processes every driver', async () => {
    const userIds = Array.from({ length: 10 }, (_, i) => `driver-${i}`);
    const { fn, getMax } = trackConcurrency(async () => {
      await delay(5);
      return { data: true, error: null };
    });
    mockRpc.mockImplementation((name: string, params: unknown) => fn(name, params));

    const { error, availableByUserId } = await checkDriversAvailable(userIds);

    expect(error).toBeNull();
    expect(mockRpc).toHaveBeenCalledTimes(10);
    expect(getMax()).toBeLessThanOrEqual(3);
    expect(getMax()).toBeGreaterThan(0);
    for (const id of userIds) {
      expect(availableByUserId.get(id)).toBe(true);
    }
  });

  it('dedupes and trims input ids before issuing RPC calls, one call per unique id', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await checkDriversAvailable(['driver-1', ' driver-1 ', 'driver-2', '', '  ']);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('is_driver_available', { p_user_id: 'driver-1' });
    expect(mockRpc).toHaveBeenCalledWith('is_driver_available', { p_user_id: 'driver-2' });
  });

  it('returns availability for every driver whose RPC succeeded, omits ones that errored, and surfaces the first error by input order', async () => {
    mockRpc.mockImplementation((_name: string, params: { p_user_id: string }) => {
      if (params.p_user_id === 'driver-1') {
        return Promise.resolve({ data: null, error: { message: 'boom-1' } });
      }
      if (params.p_user_id === 'driver-3') {
        return Promise.resolve({ data: null, error: { message: 'boom-3' } });
      }
      return Promise.resolve({ data: true, error: null });
    });

    const { error, availableByUserId } = await checkDriversAvailable([
      'driver-0',
      'driver-1',
      'driver-2',
      'driver-3',
    ]);

    // First failure by input order preserved (driver-1 precedes driver-3).
    expect(error?.message).toBe('boom-1');
    expect(availableByUserId.get('driver-0')).toBe(true);
    expect(availableByUserId.get('driver-2')).toBe(true);
    expect(availableByUserId.has('driver-1')).toBe(false);
    expect(availableByUserId.has('driver-3')).toBe(false);
  });

  it('returns an empty map and null error for empty input, without calling the RPC', async () => {
    const { error, availableByUserId } = await checkDriversAvailable([]);

    expect(error).toBeNull();
    expect(availableByUserId.size).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns an empty map and null error when input is only blank/whitespace ids', async () => {
    const { error, availableByUserId } = await checkDriversAvailable(['', '   ']);

    expect(error).toBeNull();
    expect(availableByUserId.size).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
