import { marketBidsFromQueryData } from "@/features/network/services/findLoadsForOrg.service";

jest.mock("@/lib/supabase", () => ({ supabase: () => ({}) }));

const bid = {
  id: "bid-1",
  indent_id: "indent-1",
  status: "accepted" as const,
};

describe("marketBidsFromQueryData", () => {
  it("reads the bare array cached by the allocation wizard", () => {
    expect(marketBidsFromQueryData([bid])).toEqual([bid]);
  });

  it("reads the { bids } object cached by Find Loads", () => {
    expect(marketBidsFromQueryData({ error: null, bids: [bid] })).toEqual([bid]);
  });

  it("returns an empty list when the cache value is not a bid list", () => {
    expect(marketBidsFromQueryData({ error: null, bids: { indent_id: "x" } })).toEqual([]);
    expect(marketBidsFromQueryData(null)).toEqual([]);
    expect(marketBidsFromQueryData(undefined)).toEqual([]);
  });
});
