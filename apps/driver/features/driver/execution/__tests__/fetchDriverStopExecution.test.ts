import { fetchDriverStopExecution } from '../fetchDriverStopExecution';
import { shouldShowDriverMultiStop } from '../normalizeDriverStopExecution';

const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('@pulse/core/lib/supabase', () => ({
  supabase: () => ({
    from: mockFrom,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
});

describe('fetchDriverStopExecution', () => {
  it('reads SES joined to execution_plan_stops by trip_id only', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const result = await fetchDriverStopExecution('trip-known');
    expect(mockFrom).toHaveBeenCalledWith('stop_execution_state');
    expect(mockSelect).toHaveBeenCalled();
    const selectArg = String(mockSelect.mock.calls[0][0]);
    expect(selectArg).toContain('execution_plan_stops');
    expect(selectArg).not.toContain('indent');
    expect(selectArg).not.toContain('execution_plan_id');
    expect(mockEq).toHaveBeenCalledWith('trip_id', 'trip-known');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(shouldShowDriverMultiStop(result.bundle.stops)).toBe(false);
    }
  });

  it('SES read error → empty stops (scalar UI)', async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: 'rls denied' } });
    const result = await fetchDriverStopExecution('trip-err');
    expect(result.ok).toBe(false);
    expect(result.bundle.stops).toHaveLength(0);
    expect(shouldShowDriverMultiStop(result.bundle.stops)).toBe(false);
  });
});
