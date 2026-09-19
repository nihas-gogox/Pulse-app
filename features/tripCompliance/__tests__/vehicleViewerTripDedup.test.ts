import type { TripRow } from "@/features/trips/services/trips.service";
import { uniqueTripsNeedingVehicleViewer } from "@/features/tripCompliance/services/tripComplianceRead.service";

function trip(
  id: string,
  vehicleId: string | null,
  ownerVehicleId?: string | null,
): TripRow {
  return {
    id,
    vehicle_id: vehicleId,
    owner_vehicle_id: ownerVehicleId ?? null,
  } as TripRow;
}

describe("uniqueTripsNeedingVehicleViewer", () => {
  it("returns one trip per missing vehicle id when many trips share a truck", () => {
    const trips = [
      trip("t1", "veh-a"),
      trip("t2", "veh-a"),
      trip("t3", "veh-b"),
      trip("t4", null, "veh-b"),
    ];
    const unique = uniqueTripsNeedingVehicleViewer(trips, new Set(), "org-1");
    expect(unique.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("skips vehicles already present in the vault index", () => {
    const trips = [trip("t1", "veh-a"), trip("t2", "veh-b")];
    const unique = uniqueTripsNeedingVehicleViewer(
      trips,
      new Set(["veh-a"]),
      "org-1",
    );
    expect(unique.map((t) => t.id)).toEqual(["t2"]);
  });

  it("returns nothing without an org (viewer RPC is org-scoped)", () => {
    expect(
      uniqueTripsNeedingVehicleViewer([trip("t1", "veh-a")], new Set(), null),
    ).toEqual([]);
  });
});
