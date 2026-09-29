import type { TripRow } from "@/features/trips/services/trips.service";
import { getTripStopCoordinate } from "@/features/trips/domain/tripStage";

export function simulateStageStopTarget(
  targetStatus: string,
): "pickup" | "drop" {
  const s = String(targetStatus ?? "").trim().toLowerCase();
  if (s === "at_drop" || s === "completed" || s === "delivered" || s === "done") {
    return "drop";
  }
  return "pickup";
}

export function resolveSimulateStageCoordinate(
  trip: Pick<
    TripRow,
    | "pickup_lat"
    | "pickup_lon"
    | "drop_lat"
    | "drop_lon"
    | "pickup_area"
    | "drop_location"
    | "drop_area"
  >,
  targetStatus: string,
  live: { lat: number | null; lng: number | null },
): { lat: number | null; lng: number | null } {
  if (
    live.lat != null &&
    live.lng != null &&
    Number.isFinite(live.lat) &&
    Number.isFinite(live.lng)
  ) {
    return { lat: live.lat, lng: live.lng };
  }
  const stop = getTripStopCoordinate(trip, simulateStageStopTarget(targetStatus));
  if (!stop) return { lat: null, lng: null };
  return { lat: stop.latitude, lng: stop.longitude };
}

export function appendBisimNote(params: {
  existingNotes: string | null | undefined;
  targetStatus: string;
  fromStatus: string;
  userName: string;
  lat: number | null;
  lng: number | null;
  at?: string;
  locationLabel?: string | null;
}): string {
  const at = params.at ?? new Date().toISOString();
  const place = (params.locationLabel ?? "").replace(/\|/g, " ").trim();
  const simEntry = `[BISIM|${params.targetStatus}|${at}|${params.lat ?? ""}|${params.lng ?? ""}|${params.userName}|${params.fromStatus}${place ? `|${place}` : ""}]`;
  const existing = params.existingNotes?.trim() || "";
  return existing ? `${existing}\n${simEntry}` : simEntry;
}

/** Local completion time shown in the simulate dialog. */
export function formatSimCompletionInput(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` for a datetime picker, in local time. */
export function toSimCompletionPickerValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hour24To12(hour24: number): { hour: number; period: "AM" | "PM" } {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return { hour, period };
}

export function hour12To24(hour12: number, period: "AM" | "PM"): number {
  const base = hour12 === 12 ? 0 : hour12;
  return period === "PM" ? base + 12 : base;
}

/** Parses a picker value into an ISO timestamp. Invalid input returns null. */
export function parseSimCompletionPickerValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

/** Parses DD/MM/YYYY HH:mm into an ISO timestamp. Invalid input returns null. */
export function parseSimCompletionInput(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

export function lastBisimCoordinate(
  entries: Array<{ lat: number | null; lng: number | null }>,
): { latitude: number; longitude: number } | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const lat = entries[i]?.lat;
    const lng = entries[i]?.lng;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}
