/**
 * Environment-selected implementation of the mapLibreCompat surface.
 *
 * As in `leafletNativeImplementation.ts`, the `require` calls must stay lazy:
 * each module throws at import time in the environment it does not belong to,
 * and the consumer reads the exports synchronously at module init.
 */
import type * as MapLibreCompat from "../mapLibreCompat.maplibreImpl";

import { createMapImplementationResolver } from "@pulse/core/lib/maps/mapImplementationRegistry";

/** The maplibre implementation is the reference shape; rnmaps mirrors it. */
export type MapLibreCompatModule = typeof MapLibreCompat;

export const resolveMapLibreCompat =
  createMapImplementationResolver<MapLibreCompatModule>({
    "expo-go": () => require("../mapLibreCompat.rnmapsImpl"),
    standalone: () => require("../mapLibreCompat.maplibreImpl"),
  });
