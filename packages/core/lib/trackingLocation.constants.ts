/**
 * Caps for trip tracking reads / geocode — aligned with global bootstrap DB-health patterns.
 * Keep SELECT/RPC payloads bounded; UI shows a subset of resolved labels.
 */
/** Max rows from `get_driver_location_history_for_trip` per trip detail load. */
export const TRIP_TRACKING_HISTORY_FETCH_LIMIT = 30;

/** Max GPS pings shown in Manifest Pulse log (newest first). */
export const MANIFEST_PULSE_PING_DISPLAY_MAX = 8;

/** Max concurrent reverse-geocode calls per trip (see mapLocationLabel.service batch). */
export const TRACKING_LOCATION_GEOCODE_MAX = 10;
