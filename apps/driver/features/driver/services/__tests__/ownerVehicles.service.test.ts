/**
 * setTripOwnerVehicle() — Owner Vehicle Link (3B.4/3C follow-up) client wrapper.
 *
 * This only exercises the TS-side payload/shape contract. The SQL-side RPC
 * (assigned-driver check, vehicle-ownership/active/deleted checks,
 * completed-trip block, NULL-clears semantics) cannot be exercised here —
 * this repo's Jest suite mocks the Supabase client, not a live Postgres —
 * and must be verified separately against a real database, matching the
 * same documented limitation as driverRelationshipWriters.service.test.ts.
 */
import { setTripOwnerVehicle } from '../ownerVehicles.service';

const mockRpc = jest.fn();

jest.mock('@pulse/core/lib/supabase', () => ({
  supabase: () => ({
    rpc: mockRpc,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setTripOwnerVehicle', () => {
  it('sends the exact RPC payload when setting a vehicle', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, trip_id: 'trip-1', owner_vehicle_id: 'vehicle-1' },
      error: null,
    });

    const res = await setTripOwnerVehicle('trip-1', 'vehicle-1');

    expect(mockRpc).toHaveBeenCalledWith('set_trip_owner_vehicle', {
      p_trip_id: 'trip-1',
      p_owner_vehicle_id: 'vehicle-1',
    });
    expect(res).toEqual({ error: null, ownerVehicleId: 'vehicle-1' });
  });

  it('sends p_owner_vehicle_id: null to explicitly clear — no separate clear call', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, trip_id: 'trip-1', owner_vehicle_id: null },
      error: null,
    });

    const res = await setTripOwnerVehicle('trip-1', null);

    expect(mockRpc).toHaveBeenCalledWith('set_trip_owner_vehicle', {
      p_trip_id: 'trip-1',
      p_owner_vehicle_id: null,
    });
    expect(res).toEqual({ error: null, ownerVehicleId: null });
  });

  it('surfaces an RPC error without throwing', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_state: vehicle is not active (current: maintenance)' },
    });

    const res = await setTripOwnerVehicle('trip-1', 'vehicle-2');

    expect(res.error).toBeInstanceOf(Error);
    expect(res.error?.message).toContain('not active');
    expect(res.ownerVehicleId).toBeNull();
  });
});
