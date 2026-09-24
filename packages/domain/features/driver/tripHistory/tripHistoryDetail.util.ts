import { humanizeAssignerDisplayName } from "../../trips/utils/driverAssignerDisplay.util";
import { formatEstimatedDuration } from "@pulse/core/lib/formatEstimatedDuration";
import { formatTime } from "@pulse/core/lib/format";
import { isAggregateTrip, tripEarningsForDriver } from "../../drivers/utils/driverUtils.util";
import type { TripRow } from "../../trips/services/trips.service";

export function isCompleted(status: string) {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "delivered" || s === "done";
}

export function isAssignedNotStarted(status: string) {
  const s = (status || "").toLowerCase();
  return s === "assigned" || s === "pending" || s === "scheduled";
}

export function isTransitStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "in_transit" || s === "transit";
}

export function isPickupProgressStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "in_progress" || s === "pickup" || s === "picked_up" || s === "started";
}

export function isAtDropStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "at_drop";
}

export function getTripProgressTitle(trip: TripRow): string {
  if (isCompleted(trip.status)) return "DELIVERED SUCCESSFULLY";
  if (isAssignedNotStarted(trip.status) && !trip.started_at) return "AWAITING ACCEPTANCE";
  if (isAtDropStatus(trip.status)) return "AT DROP-OFF LOCATION";
  if (
    isTransitStatus(trip.status) ||
    (String(trip.status || "").toLowerCase() === "in_progress" && !!trip.started_at)
  ) {
    return "TRIP IN PROGRESS";
  }
  if (isPickupProgressStatus(trip.status)) return "AT PICKUP STAGE";
  return "ACTIVE TRIP";
}

export function formatTripHistoryDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase();
}

export function formatDistance(distance: string | number | null | undefined): string {
  if (distance == null || distance === "") return "—";
  const n =
    typeof distance === "string"
      ? parseFloat(distance.replace(/[^0-9.]/g, ""))
      : Number(distance);
  if (Number.isNaN(n) || n < 0) return "—";
  return `${Math.round(n).toLocaleString("en-IN")} KM`;
}

export function splitLocationPrimarySecondary(location: string | null | undefined): {
  primary: string;
  secondary: string | null;
} {
  const raw = (location ?? "").trim();
  if (!raw) return { primary: "—", secondary: null };
  const commaIndex = raw.indexOf(",");
  if (commaIndex === -1) return { primary: raw, secondary: null };
  const primary = raw.slice(0, commaIndex).trim() || raw;
  const secondary = raw.slice(commaIndex + 1).trim() || null;
  return { primary, secondary };
}

export function formatDurationForTrip(trip: TripRow): string {
  const estimated = trip.estimated_duration?.trim();
  if (trip.started_at && trip.completed_at) {
    const start = new Date(trip.started_at).getTime();
    const end = new Date(trip.completed_at).getTime();
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours < 0 || hours < 0.05) {
      if (estimated) return formatEstimatedDuration(estimated);
      return "—";
    }
    if (hours >= 24) {
      const d = Math.floor(hours / 24);
      const h = Math.round(hours % 24);
      return h > 0 ? `${d}D ${h}H` : `${d}D`;
    }
    const hRounded = Math.round(hours * 10) / 10;
    if (hRounded > 0) return `${hRounded}H`;
    if (estimated) return formatEstimatedDuration(estimated);
    return "—";
  }
  if (estimated) {
    const asNum = parseFloat(estimated.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(asNum) || asNum <= 0) return "—";
    return formatEstimatedDuration(estimated);
  }
  return "—";
}

export function parseTripCoordinate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface MissionLogEntry {
  time: string;
  status: string;
  loc: string;
  details: string;
  atIso: string | null;
  /** App GPS place captured nearest this step. Null when no ping was stored. */
  driverLoc: string | null;
  /** `business` when the ping was simulated from the business app. */
  driverLocKind: "driver" | "business" | null;
}

export interface DriverAppLocationPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  address_label?: string | null;
  source?: string | null;
}

const APP_LOCATION_MATCH_MS = 45 * 60 * 1000;

export function formatAppCoordinateLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function appLocationLabel(point: DriverAppLocationPoint): string {
  const label = point.address_label?.trim();
  if (label) return label;
  return formatAppCoordinateLabel(point.latitude, point.longitude);
}

function nearestAppLocation(
  atIso: string | null,
  points: DriverAppLocationPoint[],
  preferLatestInRangeEndIso?: string | null,
): DriverAppLocationPoint | null {
  if (!atIso || points.length === 0) return null;
  const start = new Date(atIso).getTime();
  if (!Number.isFinite(start)) return null;

  if (preferLatestInRangeEndIso) {
    const end = new Date(preferLatestInRangeEndIso).getTime();
    if (Number.isFinite(end) && end >= start) {
      const inRange = points.filter((point) => {
        const t = new Date(point.recorded_at).getTime();
        return Number.isFinite(t) && t >= start && t <= end;
      });
      if (inRange.length > 0) return inRange[inRange.length - 1] ?? null;
    }
  }

  let best: DriverAppLocationPoint | null = null;
  let bestScore = Infinity;
  for (const point of points) {
    const t = new Date(point.recorded_at).getTime();
    if (!Number.isFinite(t)) continue;
    const delta = Math.abs(t - start);
    if (delta > APP_LOCATION_MATCH_MS) continue;
    const score = t <= start ? delta : delta + 1;
    if (score < bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return best;
}

/** Attach the app GPS place recorded nearest each timeline step. */
export function attachDriverAppLocations(
  entries: MissionLogEntry[],
  points: DriverAppLocationPoint[],
): MissionLogEntry[] {
  const sorted = [...points].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  return entries.map((entry, index) => {
    const nextAt = entries[index + 1]?.atIso ?? null;
    const isTransit = isInTransitStatus(entry.status);
    const point = nearestAppLocation(
      entry.atIso,
      sorted,
      isTransit ? nextAt : null,
    );
    return {
      ...entry,
      driverLoc: point ? appLocationLabel(point) : null,
      driverLocKind: point
        ? point.source === "simulated"
          ? "business"
          : "driver"
        : null,
    };
  });
}

export function isInTransitStatus(status: string): boolean {
  return status.trim().toLowerCase() === "in transit";
}

export function buildMissionLog(trip: TripRow): MissionLogEntry[] {
  const entries: MissionLogEntry[] = [];
  if (trip.created_at) {
    entries.push({
      time: formatTime(trip.created_at),
      status: "Assigned",
      loc: trip.pickup_area || "—",
      details:
        "Trip ID assigned to pilot. Vehicle ready for pickup at the scheduled origin.",
      atIso: trip.created_at,
      driverLoc: null,
      driverLocKind: null,
    });
  }
  if (trip.started_at) {
    entries.push({
      time: formatTime(trip.started_at),
      status: "Pickup",
      loc: trip.pickup_area || "—",
      details:
        "Cargo verified at origin. Load confirmed and departure logged for this trip.",
      atIso: trip.started_at,
      driverLoc: null,
      driverLocKind: null,
    });
    entries.push({
      time: formatTime(trip.started_at),
      status: "In transit",
      loc: trip.pickup_area || "—",
      details: "Route progress updated. Movement tracked toward the destination.",
      atIso: trip.started_at,
      driverLoc: null,
      driverLocKind: null,
    });
  }
  if (trip.completed_at) {
    entries.push({
      time: formatTime(trip.completed_at),
      status: "Delivered",
      loc: trip.drop_location || "—",
      details:
        "Handed over at destination. Trip marked complete and eligible for settlement.",
      atIso: trip.completed_at,
      driverLoc: null,
      driverLocKind: null,
    });
  }
  if (entries.length === 0 && trip.created_at) {
    entries.push({
      time: formatTime(trip.created_at),
      status: "Assigned",
      loc: trip.pickup_area || "—",
      details:
        "Trip ID assigned to pilot. Vehicle ready for pickup at the scheduled origin.",
      atIso: trip.created_at,
      driverLoc: null,
      driverLocKind: null,
    });
  }
  return entries;
}

export function getEarning(trip: TripRow) {
  const amount = tripEarningsForDriver(trip);
  if (amount <= 0) return isAggregateTrip(trip) ? "SALARY" : "—";
  return `₹${Math.round(amount).toLocaleString()}`;
}

export function getEarningAmount(trip: TripRow): number {
  return tripEarningsForDriver(trip);
}

export function getGrossRevenue(trip: TripRow): "SALARY" | number {
  if (isAggregateTrip(trip)) return "SALARY";
  return Number(trip.client_price ?? 0) || 0;
}

export function toEtaInterval(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export { humanizeAssignerDisplayName };
