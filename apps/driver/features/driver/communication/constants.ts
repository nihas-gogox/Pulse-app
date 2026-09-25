/** Supabase Realtime broadcast event for fleet → driver payment clearance. */
export const DRIVER_PAYMENT_BROADCAST_EVENT = {
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
} as const;

export type DriverPaymentBroadcastEventName =
  (typeof DRIVER_PAYMENT_BROADCAST_EVENT)[keyof typeof DRIVER_PAYMENT_BROADCAST_EVENT];

/** Per-user wallet/payment channel (primitive string in effect deps). */
export function driverPaymentBroadcastChannelName(userId: string): string {
  return `driver-payments:${userId}`;
}

/** Ledger postgres_changes registry key (one per driver row). */
export function driverLedgerRealtimeKey(driverId: string): string {
  return `driver_ledger:driver:${driverId}`;
}

/** Minimum spacing between long-haul health view reads during GPS ticks. */
export const DRIVER_LOCATION_HEALTH_FETCH_MS = 15 * 60 * 1000;

/** Debounce dashboard invalidation after payment events (single burst → one refetch). */
export const DRIVER_PAYMENT_INVALIDATE_DEBOUNCE_MS = 2_000;
