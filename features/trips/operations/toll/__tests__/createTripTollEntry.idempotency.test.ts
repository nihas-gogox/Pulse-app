import { createTripTollEntry } from '../toll.service';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({ from: mockFrom }),
}));

jest.mock('@/features/trips/operations/vehicle/vehicleOperationsLedger.service', () => ({
  createVehicleOperationLedgerDraftFromSource: jest.fn().mockResolvedValue({ error: null }),
  syncVehicleOperationLedgerDraftAmountFromSource: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/trips/operations/timeline/timelineEvents.service', () => ({
  appendTripOperationalTimelineEventSafe: jest.fn().mockResolvedValue(undefined),
}));

function insertBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    insert: jest.fn(() => builder),
    select: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const baseInput = {
  tripId: 'trip-1',
  amountInr: 100,
  enteredBy: 'user-1',
  actorRole: 'driver' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createTripTollEntry — offline sync idempotency', () => {
  it('inserts with the queue item id as idempotency_key on first sync', async () => {
    mockFrom.mockReturnValueOnce(
      insertBuilder({ data: { id: 'toll-1', trip_id: 'trip-1', amount_inr: 100 }, error: null }),
    );

    const { error, entry, alreadyExists } = await createTripTollEntry({
      ...baseInput,
      queueItemId: 'ops_456_def',
    });

    expect(error).toBeNull();
    expect(entry).not.toBeNull();
    expect(alreadyExists).toBeUndefined();
  });

  it('treats a unique-violation retry (same queue item id) as a safe no-op', async () => {
    mockFrom.mockReturnValueOnce(
      insertBuilder({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
    );

    const { error, entry, alreadyExists } = await createTripTollEntry({
      ...baseInput,
      queueItemId: 'ops_456_def',
    });

    expect(error).toBeNull();
    expect(entry).toBeNull();
    expect(alreadyExists).toBe(true);
  });

  it('still surfaces non-conflict errors', async () => {
    mockFrom.mockReturnValueOnce(
      insertBuilder({ data: null, error: { code: '23503', message: 'fk violation' } }),
    );

    const { error, entry, alreadyExists } = await createTripTollEntry({
      ...baseInput,
      queueItemId: 'ops_456_def',
    });

    expect(error).not.toBeNull();
    expect(entry).toBeNull();
    expect(alreadyExists).toBeUndefined();
  });
});
