/**
 * Persisted after completing an in-progress trip while other assignments remain.
 * Keeps Home + Notifications list passive until the driver explicitly starts accept/OTP.
 */
export const DRIVER_NOTIFY_ONLY_AFTER_MISSION_KEY =
  "driver_notify_only_assignments_after_mission";

/** Cached notification rows captured at trip completion for passive display fallback. */
export const DRIVER_POST_MISSION_PENDING_SNAPSHOT_KEY =
  "driver_post_mission_pending_snapshot";
