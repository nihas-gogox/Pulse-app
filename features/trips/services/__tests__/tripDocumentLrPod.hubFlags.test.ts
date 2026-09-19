import { loadHubPodReceiptFlags } from "../tripDocumentLrPod.service";

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: mockFrom,
  }),
}));

type QueryResult = { data: unknown; error: unknown };

function thenable(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = jest.fn(self);
  builder.in = jest.fn(self);
  builder.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("loadHubPodReceiptFlags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries trip_documents only and does not re-select trips.pod_received_at", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "trip_documents") {
        return thenable({
          data: [{ trip_id: "t1", document_type: "pod" }],
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const flags = await loadHubPodReceiptFlags(["t1", "t2"]);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("trip_documents");
    expect(flags.softTripIds).toEqual(["t1"]);
    expect(flags.hardTripIds).toEqual([]);
  });
});
