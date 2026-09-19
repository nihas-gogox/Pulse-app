import { loadHubPodReceiptFlags } from "../tripDocumentLrPod.service";

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

function docsQuery(rows: { trip_id: string; document_type: string }[]) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q.select = jest.fn(self);
  q.in = jest.fn(self);
  q.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return q;
}

describe("loadHubPodReceiptFlags", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("does not re-query trips for hard-copy POD and keeps chunks sequential", async () => {
    let active = 0;
    let maxActive = 0;
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("trip_documents");
      active += 1;
      maxActive = Math.max(maxActive, active);
      const q = docsQuery([{ trip_id: "trip-0", document_type: "pod" }]);
      const originalThen = q.then as (resolve: (v: unknown) => unknown) => Promise<unknown>;
      q.then = (resolve: (v: unknown) => unknown) =>
        originalThen(async (v) => {
          await Promise.resolve();
          active -= 1;
          return resolve(v);
        });
      return q;
    });

    const flags = await loadHubPodReceiptFlags(
      Array.from({ length: 41 }, (_, i) => `trip-${i}`),
    );

    expect(mockFrom).not.toHaveBeenCalledWith("trips");
    expect(flags.hardTripIds).toEqual([]);
    expect(flags.softTripIds.length).toBeGreaterThan(0);
    expect(maxActive).toBe(1);
  });
});
