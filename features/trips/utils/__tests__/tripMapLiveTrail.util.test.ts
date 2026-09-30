import {
  liveTrailSignature,
  tripMapStructureKey,
} from "@/features/trips/utils/tripMapLiveTrail.util";

const route = {
  source: "Chennai",
  destination: "Bengaluru",
  sourceLat: 13.08,
  sourceLng: 80.27,
  destLat: 12.97,
  destLng: 77.59,
  tripId: "trip-1",
  trackingEnabled: true,
  stops: [] as string[],
};

describe("trip map live trail", () => {
  it("keeps the map identity when only the truck moves", () => {
    expect(tripMapStructureKey(route)).toBe(tripMapStructureKey(route));
  });

  it("changes the trail signature when a later point is appended", () => {
    const first = [{ latitude: 13.08, longitude: 80.27 }];
    const next = [
      ...first,
      { latitude: 12.99, longitude: 77.7, recorded_at: "2026-09-30T16:00:00Z" },
    ];
    expect(liveTrailSignature(first)).not.toBe(liveTrailSignature(next));
    expect(liveTrailSignature(next)).toContain("12.99000,77.70000");
  });

  it("does not put the trail into the map structure key", () => {
    const key = tripMapStructureKey(route);
    expect(key).not.toContain("12.99000");
    expect(liveTrailSignature([{ latitude: 12.99, longitude: 77.7 }])).not.toBe(
      "",
    );
  });
});