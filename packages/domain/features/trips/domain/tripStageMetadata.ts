import type { TripStage, TripStageTarget } from "./tripStage";

/**
 * Presentation metadata for each trip stage — a single place both the
 * Driver App and Business App can pull title/color/icon/next-expected copy
 * from, instead of each hardcoding its own wording (see tripStageGuidance.ts
 * for the driver-app CTA copy this complements, not replaces: guidance is
 * "what should the driver do", this is "how should this stage be labeled").
 *
 * `nextExpected` only ever names something with a real event source behind
 * it (a geofence crossing, a POD upload) — never a capability that isn't
 * instrumented yet (package collection, fuel stop, rest break).
 */
export interface StageMetadata {
  stage: Exclude<TripStage, "lr">;
  title: string;
  color: "info" | "warning" | "progress" | "success";
  icon: "flag" | "map-marker" | "truck" | "check-circle";
  target: TripStageTarget;
  nextExpected: string;
}

const STAGE_METADATA: Record<Exclude<TripStage, "lr">, StageMetadata> = {
  accepted: {
    stage: "accepted",
    title: "GO TO PICKUP",
    color: "info",
    icon: "flag",
    target: "pickup",
    nextExpected: "Enter pickup geofence",
  },
  pickup: {
    stage: "pickup",
    title: "AT PICKUP",
    color: "warning",
    icon: "map-marker",
    target: "pickup",
    nextExpected: "Leave pickup",
  },
  transit: {
    stage: "transit",
    title: "TRANSIT",
    color: "progress",
    icon: "truck",
    target: "drop",
    nextExpected: "Enter drop geofence",
  },
  reached: {
    stage: "reached",
    title: "AT DROP",
    color: "warning",
    icon: "map-marker",
    target: "drop",
    nextExpected: "POD upload",
  },
  completed: {
    stage: "completed",
    title: "COMPLETED",
    color: "success",
    icon: "check-circle",
    target: "drop",
    nextExpected: "—",
  },
};

export function getStageMetadata(stage: Exclude<TripStage, "lr">): StageMetadata {
  return STAGE_METADATA[stage];
}
