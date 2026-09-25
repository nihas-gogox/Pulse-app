import { overlayViewerTripSubcontract } from "../overlayViewerTripSubcontract.util";

const shipperTrip = {
  id: "trip-1",
  organization_id: "shipper-org",
  supplier_id: null as string | null,
  supplier_rate: 20000,
  supplier_name: null as string | null,
};

const sub = { supplier_id: "partner-aerotro", rate: 18000 };

describe("overlayViewerTripSubcontract", () => {
  it("applies the viewer subcontract on a shipper-owned trip", () => {
    const named = overlayViewerTripSubcontract(
      shipperTrip,
      "awarded-org",
      sub,
      "AEROTRO",
    );
    expect(named.supplier_id).toBe("partner-aerotro");
    expect(named.supplier_rate).toBe(20000);
    expect(named.supplier_name).toBe("AEROTRO");

    const withRate = overlayViewerTripSubcontract(
      shipperTrip,
      "awarded-org",
      sub,
      "AEROTRO",
      { applyRate: true },
    );
    expect(withRate.supplier_rate).toBe(18000);
  });

  it("does not overwrite an owned trip that already has a supplier", () => {
    const owned = {
      ...shipperTrip,
      organization_id: "awarded-org",
      supplier_id: "already-set",
      supplier_name: "Existing",
    };
    const next = overlayViewerTripSubcontract(owned, "awarded-org", sub, "AEROTRO");
    expect(next.supplier_id).toBe("already-set");
    expect(next.supplier_name).toBe("Existing");
  });
});
