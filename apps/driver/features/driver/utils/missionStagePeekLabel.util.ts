/**
 * One-line status for the minimized mission sheet peek
 * (e.g. kicker "DELIVER TO" + place "Delhi").
 */
import { compactRoutePlace } from "../../../components/driver/DriverTripSheetLayout";
import type { DriverFlowStepId as StepId } from "./driverTripStatusNotes.util";

export type MissionStagePeekCopy = {
  /** Spoken / a11y full line */
  label: string;
  /** Uppercase stage verb — null for non-destination statuses */
  kicker: string | null;
  /** Place or short status body */
  place: string;
};

export function missionStagePeekCopy(
  step: StepId,
  pickupLabel: string,
  dropLabel: string,
): MissionStagePeekCopy {
  const pickup = compactRoutePlace(pickupLabel);
  const drop = compactRoutePlace(dropLabel);

  if (step === "completed") {
    return { label: "Trip completed", kicker: null, place: "Trip completed" };
  }
  if (step === "lr") {
    return {
      label: "Upload Lorry Receipt",
      kicker: "NEXT UP",
      place: "Upload Lorry Receipt",
    };
  }
  if (step === "reached") {
    const place = drop && drop !== "—" ? drop : "Drop-off";
    return {
      label: `Complete delivery · ${place}`,
      kicker: "COMPLETE DELIVERY",
      place,
    };
  }
  if (step === "accepted" || step === "pickup") {
    const place = pickup && pickup !== "—" ? pickup : "Pickup";
    return {
      label: `Pickup at ${place}`,
      kicker: "PICKUP AT",
      place,
    };
  }
  const place = drop && drop !== "—" ? drop : "Drop-off";
  return {
    label: `Deliver to ${place}`,
    kicker: "DELIVER TO",
    place,
  };
}

/** Flat string for callers that only need spoken/status text. */
export function missionStagePeekLabel(
  step: StepId,
  pickupLabel: string,
  dropLabel: string,
): string {
  return missionStagePeekCopy(step, pickupLabel, dropLabel).label;
}
