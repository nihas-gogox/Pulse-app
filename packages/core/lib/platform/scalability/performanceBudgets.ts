/**
 * Performance budgets — Scalability & Reliability Platform law.
 * Screens / actions that exceed these fail review unless the charter Evidence
 * section is updated with measured justification.
 * @see docs/SCALABILITY_PLATFORM.md
 */

export const SUBSCRIPTION_BUDGETS = {
  home: 5,
  tripDetail: 8,
  chat: 4,
  marketplace: 6,
  finance: 4,
  fleetTracking: 6,
} as const;

export type SubscriptionBudgetSurface = keyof typeof SUBSCRIPTION_BUDGETS;

export const ACTION_DB_BUDGETS = {
  placeBid: { writes: 2, triggers: 2, realtimeEvents: 2, invalidations: 2, queries: 3 },
  sendChatMessage: { writes: 2, triggers: 2, realtimeEvents: 2, invalidations: 2, queries: 2 },
  tripStatusUpdate: { writes: 2, triggers: 3, realtimeEvents: 2, invalidations: 2, queries: 3 },
  driverGpsPing: { writes: 1, triggers: 1, realtimeEvents: 1, invalidations: 0, queries: 0 },
} as const;

export type ActionDbBudgetKey = keyof typeof ACTION_DB_BUDGETS;

export const RENDER_BUDGETS = {
  realtimeMessage: 3,
  tripStatusUpdate: 2,
  /** Max location-driven re-renders per second on a focused map. */
  locationUpdatePerSec: 1,
} as const;

export const PLATFORM_SUCCESS_TARGETS = {
  dbCpuAt50UsersPct: 70,
  poolUtilizationPct: 70,
  realtimeCallbacksPerEvent: 5,
  cacheInvalidationsPerEvent: 2,
  uiRendersPerEvent: 5,
  chatP95Ms: 300,
  bidP95Ms: 500,
  failedRealtimeDeliveries: 0,
  hiddenScreenSubscriptions: 0,
} as const;

/**
 * Anomaly thresholds for the /platform-health "Chat" warnings panel —
 * observation only, not an auto-remediation trigger. Crossing one of these
 * flags something to look at during the manual-validation window; it does not
 * fire a fix. @see docs/CHAT_MIGRATION_DISCOVERIES_2026.md
 */
export const CHAT_HEALTH_WARNING_THRESHOLDS = {
  /** mark_messages_seen firing this many times more than mark_conversation_read
   *  suggests the two read-tracking paths are duplicating work (Finding 2). */
  markSeenToMarkReadRatio: 3,
  maxRealtimeChannels: 40,
  maxAvgChatOpenMs: 2000,
  maxImageFailureRatePct: 5,
} as const;
