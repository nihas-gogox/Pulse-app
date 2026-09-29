import {
  buildManifestJourneyLogs,
  getManifestCurrentStepIndex,
  getVisibleManifestJourneyLogs,
} from "@/features/trips/utils/manifestJourneyLog.util";
import type { TripRow } from "@/features/trips/services/trips.service";

const trip = {
  status: "at_drop",
  pickup_area: "Mumbai, Maharashtra",
  drop_location: "Delhi",
  drop_area: "Delhi",
  started_at: "2026-08-18T11:16:00.000Z",
  completed_at: null,
  updated_at: "2026-09-29T12:48:00.000Z",
  created_at: "2026-08-13T04:52:00.000Z",
  driver_id: "driver-1",
} as TripRow;

describe("manifest journey simulation flow", () => {
  it("shows drop-off arrival from the simulation, not as delivered", () => {
    const logs = buildManifestJourneyLogs({
      trip,
      assignmentAuditRows: [],
      simLogs: [
        {
          status: "in_progress",
          timestamp: "2026-08-18T11:16:00.000Z",
          lat: 19.07,
          lng: 72.87,
          userName: "Bhujesh",
          locationLabel: "Mumbai, Maharashtra",
        },
        {
          status: "in_transit",
          timestamp: "2026-09-29T08:09:00.000Z",
          lat: 19.07,
          lng: 72.87,
          userName: "Bhujesh",
          locationLabel: "Mumbai, Maharashtra",
        },
        {
          status: "at_drop",
          timestamp: "2026-09-29T12:48:00.000Z",
          lat: 28.6139,
          lng: 77.209,
          userName: "Bhujesh",
        },
      ],
      simLocationByKey: {
        "at_drop|2026-09-29T12:48:00.000Z": "Kartavya Path, New Delhi, 110001, India",
      },
    });
    const visible = getVisibleManifestJourneyLogs(
      logs,
      getManifestCurrentStepIndex(trip),
    );
    const drop = visible.find((row) => row.stepKey === "drop_off");
    expect(drop?.status).toBe("Arrived at drop-off");
    expect(drop?.location).toBe("Delhi");
    expect(drop?.atIso).toBe("2026-09-29T12:48:00.000Z");
    expect(visible.some((row) => row.stepKey === "delivered")).toBe(false);
    expect(visible.find((row) => row.stepKey === "pickup")?.location).toBe(
      "Mumbai, Maharashtra",
    );
  });
});
