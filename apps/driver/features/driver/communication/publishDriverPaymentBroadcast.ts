import { supabase } from '@pulse/core/lib/supabase';
import {
  DRIVER_PAYMENT_BROADCAST_EVENT,
  driverPaymentBroadcastChannelName,
} from './constants';

export type PublishDriverPaymentCompletedArgs = {
  /** Auth user id of the driver (profiles.uid), not drivers.id */
  userId: string;
  driverId: string;
  organizationId: string;
  tripId?: string | null;
  ledgerId?: string;
  type?: string;
};

/**
 * Fleet/dispatcher clients can call after posting driver_ledger so the driver app
 * updates instantly without polling transactions.
 */
export async function publishDriverPaymentCompleted(
  args: PublishDriverPaymentCompletedArgs,
): Promise<void> {
  const uid = args.userId.trim();
  if (!uid) return;
  const channel = supabase().channel(driverPaymentBroadcastChannelName(uid), {
    config: { broadcast: { self: false, ack: false } },
  });
  // try/finally guarantees the channel is always torn down — even if send()
  // rejects (network blip / Realtime error). Without this the channel was
  // orphaned on the error path (no reference retained), leaking a server-side
  // subscription and bypassing the realtimeRegistry cap/sweep.
  try {
    await channel.send({
      type: 'broadcast',
      event: DRIVER_PAYMENT_BROADCAST_EVENT.PAYMENT_COMPLETED,
      payload: {
        driverId: args.driverId,
        organizationId: args.organizationId,
        tripId: args.tripId ?? null,
        ledgerId: args.ledgerId ?? '',
        type: args.type ?? 'settlement',
      },
    });
  } finally {
    await supabase().removeChannel(channel);
  }
}
