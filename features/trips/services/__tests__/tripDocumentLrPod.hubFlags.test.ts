import { loadHubPodReceiptFlags } from "../tripDocumentLrPod.service";

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: mockFrom,
    rpc: (...args: unknown[]) => mockRpc(...args),
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
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function missing" },
    });
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

  it("prefers get_trip_documents_lr_pod_batch RPC for UUID trip ids", async () => {
    const tripA = "11111111-1111-4111-8111-111111111111";
    const tripB = "22222222-2222-4222-8222-222222222222";
    mockRpc.mockResolvedValue({
      data: [
        { trip_id: tripA, document_type: "pod", document_number: null },
        { trip_id: tripB, document_type: "lr", document_number: "LR1" },
      ],
      error: null,
    });

    const flags = await loadHubPodReceiptFlags([tripA, tripB]);

    expect(mockRpc).toHaveBeenCalledWith("get_trip_documents_lr_pod_batch", {
      p_trip_ids: expect.arrayContaining([tripA, tripB]),
    });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(flags.softTripIds).toEqual([tripA]);
    expect(flags.hardTripIds).toEqual([]);
  });
});
