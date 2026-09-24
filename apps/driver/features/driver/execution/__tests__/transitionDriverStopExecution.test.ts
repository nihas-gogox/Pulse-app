import { transitionDriverStopExecution } from '../transitionDriverStopExecution';

const maybeSingle = jest.fn();
const updateSelect = jest.fn(() => ({ maybeSingle }));
const updateEq = jest.fn();
const updateFn = jest.fn();
const refetchEq = jest.fn();
const refetchSelect = jest.fn(() => ({ eq: refetchEq }));
const mockFrom = jest.fn();

jest.mock('@pulse/core/lib/supabase', () => ({
  supabase: () => ({
    from: mockFrom,
  }),
}));

function chainUpdate() {
  const chain = {
    eq: updateEq,
    select: updateSelect,
    maybeSingle,
  };
  updateEq.mockReturnValue(chain);
  updateSelect.mockReturnValue({ maybeSingle });
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  const updateChain = chainUpdate();
  mockFrom.mockImplementation((table: string) => {
    expect(table).toBe('stop_execution_state');
    return {
      update: (patch: Record<string, unknown>) => {
        updateFn(patch);
        return updateChain;
      },
      select: refetchSelect,
    };
  });
});

describe('transitionDriverStopExecution', () => {
  it('A. pending → arrived uses conditional update and returns arrived_at', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        trip_id: 't1',
        stop_id: 's1',
        sequence: 1,
        status: 'arrived',
        driver_id: 'drv-1',
        arrived_at: '2026-09-13T10:00:00.000Z',
        completed_at: null,
      },
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'arrive',
      nowIso: '2026-09-13T10:00:00.000Z',
    });

    expect(updateFn).toHaveBeenCalledWith({
      status: 'arrived',
      arrived_at: '2026-09-13T10:00:00.000Z',
    });
    const patch = updateFn.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(['arrived_at', 'status']);
    expect(updateEq).toHaveBeenCalledWith('trip_id', 't1');
    expect(updateEq).toHaveBeenCalledWith('stop_id', 's1');
    expect(updateEq).toHaveBeenCalledWith('status', 'pending');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.status).toBe('arrived');
      expect(result.row.arrived_at).toBe('2026-09-13T10:00:00.000Z');
    }
  });

  it('B. arrived → completed preserves arrived_at and does not write trips', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        trip_id: 't1',
        stop_id: 's1',
        sequence: 1,
        status: 'completed',
        arrived_at: '2026-09-13T10:00:00.000Z',
        completed_at: '2026-09-13T10:05:00.000Z',
      },
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'complete',
      nowIso: '2026-09-13T10:05:00.000Z',
    });

    expect(mockFrom).not.toHaveBeenCalledWith('trips');
    expect(mockFrom).not.toHaveBeenCalledWith('execution_plan_stops');
    expect(updateFn).toHaveBeenCalledWith({
      status: 'completed',
      completed_at: '2026-09-13T10:05:00.000Z',
    });
    expect(updateEq).toHaveBeenCalledWith('status', 'arrived');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.arrived_at).toBe('2026-09-13T10:00:00.000Z');
      expect(result.row.completed_at).toBe('2026-09-13T10:05:00.000Z');
    }
  });

  it('C. completed cannot arrive — refetch authoritative, no fabricated success', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    refetchEq.mockResolvedValue({
      data: [
        {
          trip_id: 't1',
          stop_id: 's1',
          sequence: 1,
          status: 'completed',
          arrived_at: 'a',
          completed_at: 'c',
        },
      ],
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'arrive',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refetchedBundle?.stops[0].status).toBe('completed');
    }
  });

  it('D. pending cannot complete directly', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    refetchEq.mockResolvedValue({
      data: [{ trip_id: 't1', stop_id: 's1', sequence: 1, status: 'pending' }],
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'complete',
    });
    expect(result.ok).toBe(false);
  });

  it('E. double arrive is idempotent without timestamp reset', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    refetchEq.mockResolvedValue({
      data: [
        {
          trip_id: 't1',
          stop_id: 's1',
          sequence: 1,
          status: 'arrived',
          arrived_at: 'original-arrived',
        },
      ],
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'arrive',
      nowIso: 'should-not-write',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('idempotent');
      expect(result.row.arrived_at).toBe('original-arrived');
    }
  });

  it('F. double complete is idempotent', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    refetchEq.mockResolvedValue({
      data: [
        {
          trip_id: 't1',
          stop_id: 's1',
          sequence: 1,
          status: 'completed',
          completed_at: 'original-complete',
        },
      ],
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'complete',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('idempotent');
  });

  it('G. stale zero-row update refetches SES only', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    refetchEq.mockResolvedValue({
      data: [{ trip_id: 't1', stop_id: 's1', sequence: 1, status: 'failed' }],
      error: null,
    });

    const result = await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'arrive',
    });
    expect(refetchEq).toHaveBeenCalledWith('trip_id', 't1');
    expect(mockFrom).not.toHaveBeenCalledWith('trips');
    expect(mockFrom).not.toHaveBeenCalledWith('indents');
    expect(result.ok).toBe(false);
  });

  it('M/N/O. never writes driver_id, plan fields, or trips.status', async () => {
    maybeSingle.mockResolvedValue({
      data: { trip_id: 't1', stop_id: 's1', status: 'arrived', arrived_at: 'a' },
      error: null,
    });
    await transitionDriverStopExecution({
      tripId: 't1',
      stopId: 's1',
      transition: 'arrive',
      nowIso: 'now',
    });
    const patch = updateFn.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('driver_id');
    expect(patch).not.toHaveProperty('display_name');
    expect(patch).not.toHaveProperty('address_line');
    expect(patch).not.toHaveProperty('sequence');
    expect(patch).not.toHaveProperty('stop_type');
    expect(mockFrom.mock.calls.every(([table]) => table === 'stop_execution_state')).toBe(true);
  });
});
