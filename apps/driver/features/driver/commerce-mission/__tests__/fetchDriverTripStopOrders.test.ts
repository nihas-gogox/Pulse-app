import { GET_DRIVER_TRIP_STOP_ORDERS_RPC } from '../driverTripStopOrders.types';
import { fetchDriverTripStopOrders } from '../fetchDriverTripStopOrders';

const mockRpc = jest.fn();

jest.mock('@pulse/core/lib/supabase', () => ({
  supabase: () => ({
    rpc: mockRpc,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchDriverTripStopOrders', () => {
  it('calls only Primitive A with p_trip_id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const result = await fetchDriverTripStopOrders('trip-known');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(GET_DRIVER_TRIP_STOP_ORDERS_RPC, {
      p_trip_id: 'trip-known',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.tripId).toBe('trip-known');
      expect(result.mission.stops).toHaveLength(0);
    }
  });

  it('blank tripId does not call the RPC', async () => {
    const result = await fetchDriverTripStopOrders('  ');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mission.stops).toHaveLength(0);
  });

  it('RPC error → ok false, empty mission, no extra queries', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    const result = await fetchDriverTripStopOrders('trip-err');
    expect(result.ok).toBe(false);
    expect(result.mission.stops).toHaveLength(0);
    expect(result.mission.executionPlanId).toBeNull();
    if (!result.ok) expect(result.error.message).toBe('permission denied');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
