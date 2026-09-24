import { formatTrackingDateTime } from "./formatTrackingTimestamp.util";
import { DRIVER_LOCATION_STALE_MS } from "./tripTrackingStatus.util";

export function formatDriverCoordinateLabel(lat: number, lng: number): string {
  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${latHem}, ${Math.abs(lng).toFixed(5)}°${lngHem}`;
}

/** Best-effort city from reverse-geocode or "Area, City, State" strings. */
export function extractCityFromLocationLabel(
  label: string | null | undefined,
): string | null {
  const raw = (label ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length >= 3) return parts[parts.length - 2] ?? parts[1] ?? parts[0];
  if (parts.length === 2) return parts[1] ?? parts[0];
  return parts[0];
}

export type DriverLastPingDisplay = {
  /** Full reverse-geocode / address string when available. */
  locationLabel: string | null;
  cityLabel: string | null;
  coordinateLabel: string | null;
  recordedAtLabel: string | null;
  hasPing: boolean;
};

/** Compact ping time for trip hub cards (IST) — date and time. */
export function formatHubPingTimeLabel(recordedAt: string): string {
  return formatTrackingDateTime(recordedAt);
}

/** Red offline line on hub cards — days when stale ≥ 1d, else hours/minutes. */
export function formatHubPingOfflineLabel(
  recordedAt: string | null | undefined,
  staleMs: number = DRIVER_LOCATION_STALE_MS,
): string | null {
  const raw = (recordedAt ?? "").trim();
  if (!raw) return "Offline";
  const then = new Date(raw).getTime();
  if (!Number.isFinite(then)) return "Offline";
  const diffMs = Math.max(0, Date.now() - then);
  if (diffMs <= staleMs) return null;
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) return `Offline ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `Offline ${hours} hr`;
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  return `Offline ${mins} min`;
}

/** Human-readable duration since last GPS ping (for offline banner). */
export function formatDriverOfflineDuration(
  recordedAt: string | null | undefined,
): string | null {
  const raw = (recordedAt ?? "").trim();
  if (!raw) return null;
  const then = new Date(raw).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Math.max(0, Date.now() - then);
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 1) return "less than 1 min";
  if (diffM < 60) return `${diffM} min`;
  const diffH = Math.floor(diffM / 60);
  const remM = diffM % 60;
  if (diffH < 24) {
    return remM > 0 ? `${diffH} hr ${remM} min` : `${diffH} hr`;
  }
  const diffD = Math.floor(diffH / 24);
  const remH = diffH % 24;
  if (remH > 0) return `${diffD} day${diffD === 1 ? "" : "s"} ${remH} hr`;
  return `${diffD} day${diffD === 1 ? "" : "s"}`;
}

export type DriverOfflineBannerCopy = {
  headline: string;
  locationLine: string;
  timeLine: string;
};

export function buildDriverOfflineBannerCopy(params: {
  lastPing: DriverLastPingDisplay;
  recordedAt?: string | null;
}): DriverOfflineBannerCopy {
  const offlineFor = formatDriverOfflineDuration(params.recordedAt);
  const headline = offlineFor
    ? `Driver offline for ${offlineFor}`
    : "Driver is offline";

  const locationParts: string[] = [];
  if (params.lastPing.cityLabel?.trim()) {
    locationParts.push(params.lastPing.cityLabel.trim());
  }
  if (params.lastPing.coordinateLabel?.trim()) {
    locationParts.push(params.lastPing.coordinateLabel.trim());
  }
  const locationLine =
    locationParts.length > 0
      ? `Last location: ${locationParts.join(" · ")}`
      : "Last location: not recorded yet";

  const timeLine = params.lastPing.recordedAtLabel
    ? `Last ping: ${params.lastPing.recordedAtLabel}`
    : "Last ping: unknown";

  return { headline, locationLine, timeLine };
}

export function buildDriverLastPingDisplay(params: {
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
  recordedAt?: string | null;
}): DriverLastPingDisplay {
  const lat = params.latitude;
  const lng = params.longitude;
  const hasCoords =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const addressRaw = (params.locationAddress ?? "").trim();
  const cityLabel = extractCityFromLocationLabel(params.locationAddress);
  const locationLabel = addressRaw || cityLabel || null;
  const coordinateLabel = hasCoords
    ? formatDriverCoordinateLabel(lat!, lng!)
    : null;
  const recordedAtLabel = params.recordedAt
    ? formatTrackingDateTime(params.recordedAt)
    : null;
  return {
    locationLabel,
    cityLabel,
    coordinateLabel,
    recordedAtLabel,
    hasPing: hasCoords || !!locationLabel || !!recordedAtLabel,
  };
}
