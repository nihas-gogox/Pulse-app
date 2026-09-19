/**
 * POD_IN_CHUNK (40): digital POD ID lookups must stay sequential
 * and must not emit PostgREST IN lists larger than the chunk.
 */
import { fetchDigitalPodTripIdsForInvoice } from '../invoicing.service';

const mockInChunks: string[][] = [];
let mockInFlight = 0;
let mockMaxConcurrent = 0;

jest.mock('@/lib/supabase', () => ({
  supabase: () => ({
    from: (table: string) => {
      expect(table).toBe('trip_documents');
      return {
        select: () => ({
          in: (_col: string, chunk: string[]) => {
            mockInChunks.push([...chunk]);
            mockInFlight += 1;
            mockMaxConcurrent = Math.max(mockMaxConcurrent, mockInFlight);
            return {
              eq: async () => {
                const data = chunk.map((id) => ({ trip_id: id }));
                await Promise.resolve();
                mockInFlight -= 1;
                return { data, error: null };
              },
            };
          },
        }),
      };
    },
  }),
}));

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `trip-${i + 1}`);
}

beforeEach(() => {
  mockInChunks.length = 0;
  mockInFlight = 0;
  mockMaxConcurrent = 0;
});

describe('fetchDigitalPodTripIdsForInvoice chunking', () => {
  it('39 ids → one request containing every id', async () => {
    const input = ids(39);
    const found = await fetchDigitalPodTripIdsForInvoice(input);
    expect(mockInChunks).toHaveLength(1);
    expect(mockInChunks[0]).toEqual(input);
    expect(found.size).toBe(39);
    expect([...found].sort()).toEqual([...input].sort());
    expect(mockMaxConcurrent).toBe(1);
  });

  it('40 ids → one request containing every id', async () => {
    const input = ids(40);
    const found = await fetchDigitalPodTripIdsForInvoice(input);
    expect(mockInChunks).toHaveLength(1);
    expect(mockInChunks[0]).toHaveLength(40);
    expect(found.size).toBe(40);
    expect([...found].sort()).toEqual([...input].sort());
    expect(mockMaxConcurrent).toBe(1);
  });

  it('41 ids → two sequential requests and every id in the result', async () => {
    const input = ids(41);
    const found = await fetchDigitalPodTripIdsForInvoice(input);
    expect(mockInChunks).toHaveLength(2);
    expect(mockInChunks[0]).toHaveLength(40);
    expect(mockInChunks[1]).toEqual(['trip-41']);
    expect(mockInChunks[0].concat(mockInChunks[1])).toEqual(input);
    expect(found.size).toBe(41);
    expect([...found].sort()).toEqual([...input].sort());
    expect(mockMaxConcurrent).toBe(1);
  });
});
