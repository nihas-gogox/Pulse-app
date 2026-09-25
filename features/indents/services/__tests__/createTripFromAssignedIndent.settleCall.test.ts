/**
 * Regression guard for the Convert -> Trip latency fix: create_trip_from_assigned_indent
 * settles the Marketplace fee itself, atomically with trip creation. A separate client-side
 * settle_marketplace_fee_as_cash_for_indent call before it was redundant (extra round trip
 * on every deploy) and a correctness risk (fee charged, then trip creation fails separately
 * for an unrelated reason, leaving the org charged with no trip).
 */
import { createTripFromAssignedIndent } from '../indentConversionService';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({ rpc: mockRpc }),
}));

beforeEach(() => {
  mockRpc.mockReset();
});

describe('createTripFromAssignedIndent — fee settlement is not duplicated client-side', () => {
  it('calls only create_trip_from_assigned_indent, not settle_marketplace_fee_as_cash_for_indent', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'trip-1' }], error: null });

    const { error, trip } = await createTripFromAssignedIndent('indent-1', {
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
    });

    expect(error).toBeNull();
    expect(trip).toEqual({ id: 'trip-1' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'create_trip_from_assigned_indent',
      expect.objectContaining({ p_indent_id: 'indent-1' }),
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      'settle_marketplace_fee_as_cash_for_indent',
      expect.anything(),
    );
  });

  it('surfaces a fee_payment_pending failure from the RPC itself, not from a separate settle call', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'fee_payment_pending: platform fee must be paid before deploy' },
    });

    const { error, trip } = await createTripFromAssignedIndent('indent-1');

    expect(trip).toBeNull();
    expect(error?.message).toMatch(/fee_payment_pending/i);
    // Still exactly one RPC call — the failure came from create_trip_from_assigned_indent
    // itself, not from a preceding settle round trip.
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
