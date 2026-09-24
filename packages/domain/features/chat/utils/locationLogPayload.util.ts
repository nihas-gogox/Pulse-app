import type { TripMessageRow } from "../types/chat.types";
import { mergeMessageMetadataForEventPayload } from "./eventPayloadMerge.util";

/** `system_log` / `event_payload.location_data` shape (driver cycle or heartbeat). */
export interface SystemLogLocationData {
  lat: number;
  lng: number;
  address_name?: string | null;
  odometer_km?: number | null;
  recorded_at?: string | null;
}

function coerceLatLng(
  source: Record<string, unknown>,
): { lat: number; lng: number; address_name: string | null } | null {
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude ?? source.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addressRaw =
    source.address_name ?? source.address_hint ?? source.address ?? source.label;
  const address_name =
    typeof addressRaw === "string" && addressRaw.trim() ? addressRaw.trim() : null;
  return { lat, lng, address_name };
}

function locationFromRecord(ld: unknown): SystemLogLocationData | null {
  if (!ld || typeof ld !== "object" || Array.isArray(ld)) return null;
  const coords = coerceLatLng(ld as Record<string, unknown>);
  if (!coords) return null;
  const odoRaw = (ld as { odometer_km?: unknown }).odometer_km;
  const odometer_km =
    odoRaw != null && Number.isFinite(Number(odoRaw)) ? Number(odoRaw) : null;
  const recRaw = (ld as { recorded_at?: unknown }).recorded_at;
  const recorded_at =
    typeof recRaw === "string" && recRaw.trim() ? recRaw.trim() : null;
  return { ...coords, odometer_km, recorded_at };
}

function parseMetadataObject(raw: unknown): Record<string, unknown> | null {
  let meta: unknown = raw;
  if (typeof meta === "string") {
    const s = meta.trim();
    if (!s) return null;
    try {
      meta = JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

export function parseSystemLogLocationData(row: Partial<TripMessageRow>): SystemLogLocationData | null {
  const mt = row.message_type;
  if (mt !== "system_log" && mt !== "system" && mt !== "update" && mt !== "location_log") return null;
  const m = mergeMessageMetadataForEventPayload(row);
  if (!m) return null;
  const ep = m.event_payload as Record<string, unknown> | undefined;
  const fromEp = locationFromRecord(ep?.location_data);
  if (fromEp) return fromEp;
  const fromMeta = locationFromRecord(m.location_data);
  if (fromMeta) return fromMeta;
  return locationFromRecord(m);
}

/** Any trip message row that carries lat/lng (tracking ping, location_log, system_log). */
export function parseMessageLocationData(row: Partial<TripMessageRow>): SystemLogLocationData | null {
  const fromSystem = parseSystemLogLocationData(row);
  if (fromSystem) return fromSystem;
  if (row.message_type !== "tracking") return null;
  const m = mergeMessageMetadataForEventPayload(row) ?? parseMetadataObject(row.metadata);
  if (!m) return null;
  return locationFromRecord(m);
}

/** Universal maps deep link (works on iOS, Android, and web). */
export function mapsUrlForCoordinates(lat: number, lng: number, label?: string | null): string {
  const coords = `${lat},${lng}`;
  const query = label?.trim() ? encodeURIComponent(`${coords} (${label.trim()})`) : encodeURIComponent(coords);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
