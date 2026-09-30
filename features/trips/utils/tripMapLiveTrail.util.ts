export type LiveTrailPoint = {
  latitude: number;
  longitude: number;
  recorded_at?: string;
};

/** Identity of the Leaflet map. GPS pings and trail points are not included. */
export function tripMapStructureKey(input: {
  source?: string | null;
  destination?: string | null;
  sourceLat?: number | null;
  sourceLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  tripId?: string | null;
  trackingEnabled?: boolean;
  stops?: string[];
}): string {
  return [
    input.tripId ?? "",
    input.trackingEnabled ? "1" : "0",
    input.source ?? "",
    input.destination ?? "",
    input.sourceLat ?? "",
    input.sourceLng ?? "",
    input.destLat ?? "",
    input.destLng ?? "",
    (input.stops ?? []).join("|"),
  ].join("§");
}

/** Changes when a trail point is added or moved. Unrelated GPS fields are omitted. */
export function liveTrailSignature(
  points: LiveTrailPoint[] | null | undefined,
): string {
  if (!points?.length) return "";
  return points
    .filter(
      (point) =>
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
    )
    .map(
      (point) =>
        `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
    )
    .join("|");
}
