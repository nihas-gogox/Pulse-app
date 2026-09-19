/**
 * Bulk ratings fetch: callers only need id (dedupe), rated_id (group), score (avg/count).
 */
import {
  averageScore,
  averageScoreDeduped,
  getRatingsForDrivers,
} from '../ratings.service';

let mockSelectArg: string | null = null;
const mockInChunks: string[][] = [];

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({
    from: (table: string) => {
      expect(table).toBe('ratings');
      return {
        select: (cols: string) => {
          mockSelectArg = cols;
          return {
            eq: () => ({
              in: (_col: string, chunk: string[]) => {
                mockInChunks.push([...chunk]);
                return {
                  order: async () => ({
                    data: chunk.map((rated_id) => ({
                      id: `rating-${rated_id}`,
                      rated_id,
                      score: 5,
                    })),
                    error: null,
                  }),
                };
              },
            }),
          };
        },
      };
    },
  }),
}));

beforeEach(() => {
  mockSelectArg = null;
  mockInChunks.length = 0;
});

describe('fetchRatingsByRatedIds projection', () => {
  it('selects only id, rated_id, score', async () => {
    await getRatingsForDrivers(['d1']);
    expect(mockSelectArg).toBe('id, rated_id, score');
  });

  it('groups by rated_id and preserves scores for average/dedupe', async () => {
    const ids = ['d1', 'd2'];
    const { error, byDriverId } = await getRatingsForDrivers(ids);
    expect(error).toBeNull();
    expect(Object.keys(byDriverId).sort()).toEqual(['d1', 'd2']);
    expect(byDriverId.d1).toHaveLength(1);
    expect(byDriverId.d1[0]).toEqual({
      id: 'rating-d1',
      rated_id: 'd1',
      score: 5,
    });
    expect(averageScore(byDriverId.d1)).toBe(5);
    expect(averageScoreDeduped(byDriverId.d1)).toBe(5);
    expect(mockInChunks).toHaveLength(1);
  });
});
