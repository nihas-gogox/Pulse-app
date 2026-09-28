import {
  ledgerClientTripRows,
  viewerOwnedClientTrips,
} from "@/features/clients/utils/viewerClientTrips.util";

const client = { id: "client-aero", name: "AERO", contact_person: null };

describe("viewerOwnedClientTrips", () => {
  it("keeps viewer-org trips for this client and drops the linked org's own trips", () => {
    const rows = viewerOwnedClientTrips(
      [
        { id: "1", organization_id: "gogo", client_id: "client-aero", client_name: "AERO" },
        { id: "2", organization_id: "gogo", client_id: null, client_name: "aero" },
        { id: "3", organization_id: "aero-org", client_id: "someone", client_name: "Own operations" },
        { id: "4", organization_id: "gogo", client_id: "other", client_name: "Apple" },
        { id: "5", organization_id: "gogo", client_id: "client-aero", deleted_at: "2026-01-01" },
      ],
      "gogo",
      client,
    );
    expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
  });

  it("shows every finance ledger trip that the page already loaded", () => {
    const catalog = [
      { id: "own-1" },
      { id: "own-2" },
    ];
    expect(ledgerClientTripRows(catalog, [], ["own-2", "own-1"]).map((row) => row.id)).toEqual([
      "own-2",
      "own-1",
    ]);
  });
});
