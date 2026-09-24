/**
 * Native entry point for the react-native-maps-shaped map API.
 *
 * Implementation selection is delegated to the map registry — see
 * `lib/maps/mapEnvironment.ts` for why this cannot be a bundler/platform-extension
 * decision, and `lib/maps/mapImplementationRegistry.ts` for the injection seam.
 */
import { resolveMapLibreCompat } from "./maps/mapLibreCompatImplementation";

const impl = resolveMapLibreCompat();

export const Marker = impl?.Marker;
export const Polyline = impl?.Polyline;
export const Callout = impl?.Callout;
export const PROVIDER_GOOGLE = impl?.PROVIDER_GOOGLE;
export type { CompatMapRef } from "./mapLibreCompat.maplibreImpl";
export default impl?.default;
