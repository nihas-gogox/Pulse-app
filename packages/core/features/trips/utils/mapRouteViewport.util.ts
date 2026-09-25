export type MapCoordinate = { latitude: number; longitude: number };

const MIN_BOUNDS_DELTA = 0.02;

function isValidCoordinate(
  point: Partial<MapCoordinate> | null | undefined,
): point is MapCoordinate {
  return (
    !!point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude)
  );
}

/** Expand degenerate bounds so fitBounds does not over-zoom a single point. */
export function boundsFromCoordinates(
  points: Array<Partial<MapCoordinate> | null | undefined>,
  minDelta = MIN_BOUNDS_DELTA,
): { ne: MapCoordinate; sw: MapCoordinate } | null {
  const valid = points.filter(isValidCoordinate);
  if (valid.length === 0) return null;

  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;
  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;

  for (const p of valid) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }

  if (maxLat - minLat < minDelta) {
    const half = minDelta / 2;
    minLat -= half;
    maxLat += half;
  }
  if (maxLng - minLng < minDelta) {
    const half = minDelta / 2;
    minLng -= half;
    maxLng += half;
  }

  return {
    sw: { latitude: minLat, longitude: minLng },
    ne: { latitude: maxLat, longitude: maxLng },
  };
}

/**
 * Expand geographic bounds by a fraction of their span (plus a floor) so
 * fitToCoordinates / fitBounds zooms out further — short legs otherwise
 * pin to max zoom even with large edge padding.
 */
export function inflateMapBounds(
  bounds: { ne: MapCoordinate; sw: MapCoordinate },
  spanFactor = 0.55,
  minPadDeg = 0.035,
): { ne: MapCoordinate; sw: MapCoordinate } {
  const midLat = (bounds.ne.latitude + bounds.sw.latitude) / 2;
  const midLng = (bounds.ne.longitude + bounds.sw.longitude) / 2;
  const halfLat = Math.abs(bounds.ne.latitude - bounds.sw.latitude) / 2;
  const halfLng = Math.abs(bounds.ne.longitude - bounds.sw.longitude) / 2;
  const padLat = Math.max(halfLat * spanFactor, minPadDeg);
  const padLng = Math.max(halfLng * spanFactor, minPadDeg);
  return {
    ne: {
      latitude: midLat + halfLat + padLat,
      longitude: midLng + halfLng + padLng,
    },
    sw: {
      latitude: midLat - halfLat - padLat,
      longitude: midLng - halfLng - padLng,
    },
  };
}

export function latLngTuplesToCoordinates(
  tuples: [number, number][],
): MapCoordinate[] {
  return tuples.map(([latitude, longitude]) => ({ latitude, longitude }));
}
