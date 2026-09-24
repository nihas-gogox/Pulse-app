import { extractCityFromLocationLabel } from "../../trips/utils/driverLastPingDisplay.util";
import type { TripMessageRow } from "../types/chat.types";
import { mergeMessageMetadataForEventPayload } from "./eventPayloadMerge.util";
import {
  parseMessageLocationData,
  parseSystemLogLocationData,
  type SystemLogLocationData,
} from "./locationLogPayload.util";

export type LocationPingTripHint = {
  pickupArea?: string | null;
  dropLocation?: string | null;
  status?: string | null;
};

function eventPayload(row: Partial<TripMessageRow>): Record<string, unknown> | null {
  const m = mergeMessageMetadataForEventPayload(row);
  const ep = m?.event_payload;
  if (!ep || typeof ep !== "object" || Array.isArray(ep)) return null;
  return ep as Record<string, unknown>;
}

/** True when the row is a driver location ping (not a trip status broadcast). */
export function isLocationPingMessage(row: Partial<TripMessageRow>): boolean {
  const mt = row.message_type;
  if (mt === "tracking") return parseMessageLocationData(row) !== null;

  if (
    mt === "system_log" ||
    mt === "system" ||
    mt === "update" ||
    mt === "location_log"
  ) {
    const ep = eventPayload(row);
    if (ep?.location_ping === true) return true;
    if (ep?.new_status != null && String(ep.new_status).trim() !== "") return false;
    if ((row.metadata as { trip_status_broadcast?: string } | null)?.trip_status_broadcast === "1") {
      return false;
    }
    return parseSystemLogLocationData(row) !== null;
  }
  return false;
}

export function isSimulatedLocationPing(row: Partial<TripMessageRow>): boolean {
  const ep = eventPayload(row);
  if (ep?.simulated === true) return true;
  const body = (row.content ?? "").toLowerCase();
  return body.includes("simulated");
}

export function isSimulatedSystemMessage(row: Partial<TripMessageRow>): boolean {
  const ep = eventPayload(row);
  if (ep?.simulated === true) return true;
  const body = (row.content ?? "").toLowerCase();
  return body.includes("simulated");
}

function tripHintCity(hint?: LocationPingTripHint): string | null {
  if (!hint) return null;
  const status = (hint.status ?? "").trim().toLowerCase();
  const drop = (hint.dropLocation ?? "").trim();
  const pickup = (hint.pickupArea ?? "").trim();
  if (status === "at_drop" || status === "completed" || status === "delivered") {
    return drop || pickup || null;
  }
  if (
    status === "picked_up" ||
    status === "in_transit" ||
    status === "in_progress"
  ) {
    return pickup || drop || null;
  }
  return pickup || drop || null;
}

/**
 * True when the city label can be traced to an actual reading (reverse-geocoded
 * GPS, or a location embedded in the message content itself) rather than a
 * guess derived from the trip's static pickup/drop fields. The trip-hint
 * fallback in {@link resolveLocationCityLabel} answers "where would the driver
 * plausibly be given the trip phase" — it is not a location sample, and must
 * never be presented as one (that's exactly the "Driver is at NCR" bug: NCR
 * was the trip's pickup hub, not anywhere the driver's device reported being).
 */
export function isRealLocationSample(
  location: SystemLogLocationData | null,
  messageContent?: string | null,
): boolean {
  if ((location?.address_name ?? "").trim()) return true;
  const content = (messageContent ?? "").trim();
  if (content.match(/[—–]\s*(.+?)\.?\s*$/)?.[1]) return true;
  const hyphen = content.match(/-\s*(.+?)\.?\s*$/);
  return Boolean(hyphen?.[1] && !hyphen[1].includes("UTC"));
}

/** Resolve a human city/area label — never lat/long. */
export function resolveLocationCityLabel(
  location: SystemLogLocationData | null,
  messageContent?: string | null,
  tripHint?: LocationPingTripHint,
): string {
  const addr = (location?.address_name ?? "").trim();
  if (addr) {
    const city = extractCityFromLocationLabel(addr);
    if (city) return city;
    if (addr.includes(",")) return addr;
    return addr;
  }

  const content = (messageContent ?? "").trim();
  const emDash = content.match(/[—–]\s*(.+?)\.?\s*$/);
  if (emDash?.[1]) return emDash[1].trim();
  const hyphen = content.match(/-\s*(.+?)\.?\s*$/);
  if (hyphen?.[1] && !hyphen[1].includes("UTC")) return hyphen[1].trim();

  const fromTrip = tripHintCity(tripHint);
  if (fromTrip) return fromTrip;

  return "En route";
}

export function buildLocationPingTitle(
  cityLabel: string,
  simulated: boolean,
  consolidatedCount?: number,
): string {
  if (typeof consolidatedCount === "number" && consolidatedCount > 1) {
    const base = `${consolidatedCount} driver location updates — last near ${cityLabel}`;
    return simulated ? `${base} (simulated)` : base;
  }
  const base = `Driver location update — ${cityLabel}`;
  return simulated ? `${base} (simulated)` : `${base}.`;
}

/** Split reverse-geocode label into area/road vs city/state for card sub-lines. */
export function resolveLocationPlaceAndCity(
  location: SystemLogLocationData | null,
  messageContent?: string | null,
  tripHint?: LocationPingTripHint,
): { place: string | null; city: string } {
  const city = resolveLocationCityLabel(location, messageContent, tripHint);
  const addr = (location?.address_name ?? "").trim();
  if (!addr) return { place: null, city };

  const parts = addr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const cityFromAddr = extractCityFromLocationLabel(addr);

  if (parts.length >= 3) {
    const stateOrCity = cityFromAddr || city;
    const stateIdx = parts.findIndex(
      (p) => p.toLowerCase() === stateOrCity.toLowerCase(),
    );
    if (stateIdx > 0) {
      return {
        place: parts.slice(0, stateIdx).join(", "),
        city: parts[stateIdx] || city,
      };
    }
    const placeParts = parts.slice(0, -2);
    return {
      place: placeParts.length > 0 ? placeParts.join(", ") : parts[0],
      city: cityFromAddr || city,
    };
  }

  if (parts.length === 2) {
    return { place: parts[0], city: parts[1] || city };
  }

  if (addr.toLowerCase() !== city.toLowerCase()) {
    return { place: addr, city };
  }

  return { place: null, city };
}

/** Short clock label for location ping cards (IST). */
export function formatLocationCaptureClock(
  recordedAt: string | null | undefined,
  messageCreatedAt: string,
): string {
  const raw = (recordedAt ?? "").trim() || messageCreatedAt;
  try {
    return new Date(raw).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return raw.slice(11, 16) || raw.slice(0, 5);
  }
}

/** Compact date + time for inbox / list previews (IST). */
export function formatLocationPingShortLog(
  recordedAt: string | null | undefined,
  messageCreatedAt: string,
): string {
  const raw = (recordedAt ?? "").trim() || messageCreatedAt;
  try {
    const d = new Date(raw);
    const date = d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
    });
    const time = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${date}, ${time}`;
  } catch {
    return raw.replace(/\s*UTC$/i, "").trim();
  }
}

export function buildLocationPingCardCopy(params: {
  location: SystemLogLocationData | null;
  message: Pick<TripMessageRow, "content" | "created_at">;
  simulated?: boolean;
  consolidatedCount?: number;
  tripHint?: LocationPingTripHint;
}): {
  title: string;
  subLine: string | null;
  captureClock: string;
} {
  const { place, city } = resolveLocationPlaceAndCity(
    params.location,
    params.message.content,
    params.tripHint,
  );
  const shortLog = formatLocationPingShortLog(
    params.location?.recorded_at,
    params.message.created_at,
  );
  const captureClock = formatLocationCaptureClock(
    params.location?.recorded_at,
    params.message.created_at,
  );
  const simulated = params.simulated === true;
  const consolidatedCount = params.consolidatedCount;
  // "Driver is at X" asserts a real reading — only say it when there is one.
  // Otherwise this is a trip-phase guess (pickup/drop fallback), and must read
  // as a status estimate, not a location report, or it's just a more subtle
  // version of the exact bug this distinction exists to prevent.
  const isReal = isRealLocationSample(params.location, params.message.content);
  const verb = isReal ? "Driver is at" : "Trip status — near";

  let title: string;
  if (typeof consolidatedCount === "number" && consolidatedCount > 1) {
    title = `${verb} ${city} · ${consolidatedCount} updates · ${shortLog}`;
  } else {
    title = `${verb} ${city} · ${shortLog}`;
  }
  if (simulated) {
    title = `${title} (simulated)`;
  }

  let subLine: string | null = null;
  if (place && place.toLowerCase() !== city.toLowerCase()) {
    subLine = place;
  }

  return { title, subLine, captureClock };
}

export function buildLocationPingInboxPreviewText(params: {
  location: SystemLogLocationData | null;
  message: Pick<TripMessageRow, "content" | "created_at">;
  tripHint?: LocationPingTripHint;
  simulated?: boolean;
  consolidatedCount?: number;
}): string {
  const city = resolveLocationCityLabel(
    params.location,
    params.message.content,
    params.tripHint,
  );
  const when = formatLocationPingShortLog(
    params.location?.recorded_at,
    params.message.created_at,
  );
  const simulated = params.simulated === true;
  const count = params.consolidatedCount;
  const verb = isRealLocationSample(params.location, params.message.content)
    ? "Driver is at"
    : "Trip status — near";

  let base: string;
  if (typeof count === "number" && count > 1) {
    base = `${verb} ${city} · ${count} updates · ${when}`;
  } else {
    base = `${verb} ${city} · ${when}`;
  }
  return simulated ? `${base} (simulated)` : base;
}

/** @deprecated Use {@link buildLocationPingInboxPreviewText}. */
export function buildLocationPingPreviewText(
  cityLabel: string,
  simulated: boolean,
  consolidatedCount?: number,
): string {
  const when = formatLocationPingShortLog(null, new Date().toISOString());
  if (typeof consolidatedCount === "number" && consolidatedCount > 1) {
    const base = `Driver is at ${cityLabel} · ${consolidatedCount} updates · ${when}`;
    return simulated ? `${base} (simulated)` : base;
  }
  const base = `Driver is at ${cityLabel} · ${when}`;
  return simulated ? `${base} (simulated)` : base;
}
