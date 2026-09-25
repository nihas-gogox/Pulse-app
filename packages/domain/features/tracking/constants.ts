/** Broadcast channel prefixes (isolated tracking namespace). */
export const TRACKING_CHANNEL_TRIP_PREFIX = 'tracking:trip:';
export const TRACKING_CHANNEL_FLEET_PREFIX = 'tracking:org:';
export const TRACKING_CHANNEL_FLEET_SUFFIX = ':fleet';

/** Publisher throttle — do not send at raw GPS callback rate. */
export const TRACKING_BROADCAST_MIN_INTERVAL_MS = 30_000;
export const TRACKING_BROADCAST_MIN_DISPLACEMENT_M = 50;

/** Checkpoint RPC movement gate (server also enforces). */
export const TRACKING_CHECKPOINT_MIN_INTERVAL_MS = 30_000;
export const TRACKING_CHECKPOINT_MIN_DISPLACEMENT_M = 50;

/** Stale marker if no position broadcast within this window. */
export const TRACKING_POSITION_STALE_MS = 90_000;

/** Reconnect reseed debounce. */
export const TRACKING_RESEED_DEBOUNCE_MS = 2_000;

/** Fleet map max markers before clustering (phase 2). */
export const FLEET_MAP_CLUSTER_THRESHOLD = 80;

export const TRACKING_BROADCAST_EVENT = {
  POSITION: 'position',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  CHECKPOINT: 'checkpoint',
  RESEED: 'reseed',
  PING_REQUEST: 'ping_request',
} as const;

/** Dispatcher waits this long for driver to respond before declaring ping timed out. */
export const TRACKING_PING_TIMEOUT_MS = 12_000;
