import { isIndentUnallocated } from "@/features/network/utils/loadCenter.model";
import { isLoadBasedTrip } from "@/features/trips/visibility/tripVisibility";
import {
  indentHubLifecycleStatus,
  indentHubSourceTags,
  indentHubStatusTag,
  indentHubTargetRateInr,
} from "@/features/trips/utils/indentHubCardPresentation";

describe("indentHubSourceTags", () => {
  it("maps integrated_supplier → NETWORK", () => {
    expect(indentHubSourceTags("integrated_supplier")).toEqual(["NETWORK"]);
  });

  it("maps marketplace → MARKETPLACE", () => {
    expect(indentHubSourceTags("marketplace")).toEqual(["MARKETPLACE"]);
  });

  it("maps both → NETWORK + MARKETPLACE", () => {
    expect(indentHubSourceTags("both")).toEqual(["NETWORK", "MARKETPLACE"]);
  });

  it("defaults unset to NETWORK (Give Load / create-indent default)", () => {
    expect(indentHubSourceTags(null)).toEqual(["NETWORK"]);
    expect(indentHubSourceTags(undefined)).toEqual(["NETWORK"]);
    expect(indentHubSourceTags("")).toEqual(["NETWORK"]);
  });

  it("does not invent an OFFLINE chip (Give Load had no source tag for offline)", () => {
    expect(indentHubSourceTags("offline")).toEqual([]);
  });
});

describe("indentHubLifecycleStatus", () => {
  it("uses Give Load bid-count derivation: open + no bids → WAITING FOR BID", () => {
    expect(indentHubLifecycleStatus("open", 0)).toBe("WAITING FOR BID");
  });

  it("uses Give Load bid-count derivation: open + bids → RECEIVING BIDS", () => {
    expect(indentHubLifecycleStatus("open", 3)).toBe("RECEIVING BIDS");
  });

  it("maps awarded (even with bids) → AWARDED, not a trip stage", () => {
    expect(indentHubLifecycleStatus("awarded", 4)).toBe("AWARDED");
  });
});

describe("indentHubStatusTag", () => {
  it("maps waiting, receiving bids, and awarded", () => {
    expect(indentHubStatusTag("open", 0)).toBe("pending");
    expect(indentHubStatusTag("open", 2)).toBe("bids");
    expect(indentHubStatusTag("awarded", 2)).toBe("awarded");
  });
});

describe("indentHubTargetRateInr", () => {
  it("uses supplier_target trip total, not client_price", () => {
    expect(
      indentHubTargetRateInr({
        supplier_target: 45000,
        supplier_rate_basis: "per_trip",
      }),
    ).toBe(45000);
  });
});

describe("allocation boundary trips.indent_id", () => {
  it("unallocated indent stays indent-stage even when awarded", () => {
    expect(
      isIndentUnallocated({ id: "indent-1", status: "awarded" }, new Set()),
    ).toBe(true);
    expect(indentHubLifecycleStatus("awarded", 1)).toBe("AWARDED");
  });

  it("indent with matching trip is not indent-stage; trip origin is INDENT", () => {
    expect(
      isIndentUnallocated(
        { id: "indent-1", status: "awarded" },
        new Set(["indent-1"]),
      ),
    ).toBe(false);
    expect(isLoadBasedTrip({ indent_id: "indent-1" })).toBe(true);
  });

  it("direct trip (no indent_id) is not indent-origin", () => {
    expect(isLoadBasedTrip({ indent_id: null })).toBe(false);
  });
});
