export type StopLocationAddress = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export type StopLocationInput = {
  type: 'pickup' | 'drop';
  label?: string | null;
  address?: StopLocationAddress | null;
};

function firstNonEmpty(...parts: Array<string | null | undefined>): string {
  for (const part of parts) {
    const trimmed = (part ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** City / street for a stop — never the planner label ("Pickup A") when an address exists. */
export function locationLabelFromStop(stop: StopLocationInput): string {
  const city = firstNonEmpty(stop.address?.city);
  const state = firstNonEmpty(stop.address?.state);
  const line1 = firstNonEmpty(stop.address?.line1);
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (line1 && state) return `${line1}, ${state}`;
  if (line1) return line1;
  const label = firstNonEmpty(stop.label);
  if (label) return label;
  return stop.type === 'pickup' ? 'Pickup' : 'Drop';
}

/** Joins distinct stop locations so cards/stories can wrap each stop on its own line. */
export const STOP_LOCATION_JOIN = ' · ';

export function summarizeStopsByType(
  stops: StopLocationInput[],
  type: 'pickup' | 'drop',
): string {
  const labels = [
    ...new Set(stops.filter((stop) => stop.type === type).map(locationLabelFromStop)),
  ];
  if (labels.length === 0) return type === 'pickup' ? 'Pickup' : 'Drop';
  if (labels.length === 1) return labels[0] ?? (type === 'pickup' ? 'Pickup' : 'Drop');
  return labels.join(STOP_LOCATION_JOIN);
}

