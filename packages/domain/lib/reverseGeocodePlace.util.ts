/**
 * Human-readable place lines for driver HUD / trip strips.
 * Delegates to mapLocationLabel.service (Mapbox/Nominatim); native expo is last resort.
 */
import * as Location from 'expo-location';
import {
  resolveMapLocationLabel,
  type MapLocationLabelMode,
} from './mapLocationLabel.service';
import { Platform } from 'react-native';

export function formatGeocodedPlaceLine(place: Location.LocationGeocodedAddress): string {
  const parts = [
    place.name || place.street || null,
    place.city || place.subregion || place.region || null,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : '';
}

/** City + state/region only (e.g. "Chennai, Tamil Nadu") — driver location pills / HUD. */
export function formatGeocodedCityState(place: Location.LocationGeocodedAddress): string {
  const cityRaw =
    place.city?.trim() ||
    place.subregion?.trim() ||
    (place as Location.LocationGeocodedAddress & { district?: string | null }).district?.trim() ||
    '';
  const stateRaw = place.region?.trim() || '';
  const parts = [cityRaw, stateRaw].filter(Boolean);
  return parts.join(', ');
}

async function reverseExpoNative(
  latitude: number,
  longitude: number,
  mode: MapLocationLabelMode,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const results = (await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 6500),
      ),
    ])) as Location.LocationGeocodedAddress[];

    if (!results?.length) return null;
    const line =
      mode === 'city'
        ? formatGeocodedCityState(results[0]).trim()
        : formatGeocodedPlaceLine(results[0]).trim();
    return line || null;
  } catch {
    return null;
  }
}

export async function reverseGeocodePlaceLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const api = await resolveMapLocationLabel(latitude, longitude, { mode: 'full' });
  if (api) return api;
  return reverseExpoNative(latitude, longitude, 'full');
}

/** Reverse geocode to **city, state** only (readable HUD without street noise). */
export async function reverseGeocodeCityStateLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const api = await resolveMapLocationLabel(latitude, longitude, { mode: 'city' });
  if (api) return api;
  return reverseExpoNative(latitude, longitude, 'city');
}
