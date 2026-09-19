import { fetchTripDetailBundle } from "@/lib/queries/useTripDetailBundleQuery";

jest.mock("@/lib/queryClient", () => ({
  shouldRetryQuery: () => false,
}));

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockStorageList = jest.fn();
const mockTxLimit = jest.fn();
const mockDocLimit = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: {
      from: () => ({ list: mockStorageList }),
    },
  }),
}));

type QueryResult = { data: unknown; error: unknown };

function thenable(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = jest.fn(self);
  builder.eq = jest.fn(self);
  builder.in = jest.fn(self);
  builder.order = jest.fn(self);
  builder.limit = jest.fn(self);
  builder.abortSignal = jest.fn(self);
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

const deliveredTrip = {
  id: "trip-delivered",
  status: "delivered",
  completed_at: "2026-09-19T00:00:00Z",
};

const docs = [
  {
    id: "doc-1",
    trip_id: "trip-delivered",
    file_name: "pod.jpg",
    storage_path: "trip-delivered/pod/pod.jpg",
    mime_type: "image/jpeg",
    size_bytes: 12,
    uploaded_at: "2026-09-19T00:00:00Z",
    uploaded_by: null,
    document_type: "pod",
  },
];

const txs = [{ id: "tx-1", trip_id: "trip-delivered", amount_in: 100, amount_out: 0 }];

beforeEach(() => {
  jest.clearAllMocks();
  mockTxLimit.mockImplementation(() => Promise.resolve({ data: txs, error: null }));
  mockDocLimit.mockImplementation(() => Promise.resolve({ data: docs, error: null }));
  mockFrom.mockImplementation((table: string) => {
    if (table === "trips") {
      return thenable({ data: deliveredTrip, error: null });
    }
    if (table === "trip_documents") {
      const builder = thenable({ data: docs, error: null });
      builder.limit = mockDocLimit;
      return builder;
    }
    if (table === "transactions") {
      const builder = thenable({ data: txs, error: null });
      builder.limit = mockTxLimit;
      return builder;
    }
    if (table === "trip_finance_adjustments") {
      return thenable({ data: [], error: null });
    }
    throw new Error(`unexpected table: ${table}`);
  });
});

describe("fetchTripDetailBundle — delivered light path", () => {
  it("skips get_trip_detail_bundle for delivered trips and still returns documents", async () => {
    const bundle = await fetchTripDetailBundle(
      "trip-delivered",
      "org-1",
      undefined,
      true,
    );

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockStorageList).not.toHaveBeenCalled();
    expect(mockFrom.mock.calls.filter((call) => call[0] === "trip_documents")).toHaveLength(1);
    expect(bundle?.trip.id).toBe("trip-delivered");
    expect(bundle?.documents).toEqual(docs);
    expect(bundle?.transactions).toEqual(txs);
  });

  it("caps trip-scoped ledger at 50 rows and documents at 20 (same slice as the bundle RPC)", async () => {
    await fetchTripDetailBundle("trip-delivered", "org-1", undefined, true);
    expect(mockTxLimit).toHaveBeenCalledWith(50);
    expect(mockDocLimit).toHaveBeenCalledWith(20);
  });

  it("keeps get_trip_detail_bundle for active trips", async () => {
    mockRpc.mockReturnValue(
      thenable({
        data: {
          trip: { id: "trip-active", status: "in_progress" },
          documents: [],
          transactions: [],
          assignment_audit: [],
          adjustments: [],
          driver: null,
          vehicle: null,
          client_detail: null,
          supplier_detail: null,
          otp: null,
          latest_driver_location: null,
        },
        error: null,
      }),
    );

    const bundle = await fetchTripDetailBundle(
      "trip-active",
      "org-1",
      undefined,
      false,
    );

    expect(mockRpc).toHaveBeenCalledWith("get_trip_detail_bundle", {
      p_trip_id: "trip-active",
      p_viewer_org_id: "org-1",
    });
    expect(bundle?.trip.id).toBe("trip-active");
  });

  it("on bundle RPC failure still loads documents/POD from trip_documents", async () => {
    mockRpc.mockReturnValue(thenable({ data: null, error: { message: "503" } }));

    const bundle = await fetchTripDetailBundle(
      "trip-delivered",
      "org-1",
      undefined,
      false,
    );

    expect(mockRpc).toHaveBeenCalled();
    expect(bundle?.documents).toEqual(docs);
    expect(mockStorageList).not.toHaveBeenCalled();
  });

  it("keeps text/plain place-status POD rows (no storage list)", async () => {
    const placePod = {
      ...docs[0],
      id: "doc-place",
      file_name: "left_with_security.txt",
      storage_path: "trip-delivered/pod/left_with_security.txt",
      mime_type: "text/plain",
    };
    mockDocLimit.mockImplementation(() =>
      Promise.resolve({ data: [placePod], error: null }),
    );
    mockFrom.mockImplementation((table: string) => {
      if (table === "trips") return thenable({ data: deliveredTrip, error: null });
      if (table === "trip_documents") {
        return thenable({ data: [placePod], error: null });
      }
      if (table === "transactions") {
        const builder = thenable({ data: [], error: null });
        builder.limit = mockTxLimit;
        return builder;
      }
      if (table === "trip_finance_adjustments") {
        return thenable({ data: [], error: null });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const bundle = await fetchTripDetailBundle(
      "trip-delivered",
      "org-1",
      undefined,
      true,
    );
    expect(bundle?.documents[0]?.mime_type).toBe("text/plain");
    expect(mockStorageList).not.toHaveBeenCalled();
  });
});
