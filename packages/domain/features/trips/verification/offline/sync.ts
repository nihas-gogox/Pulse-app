import { saveTripVerification } from "../verification.service";
import { uploadVerificationPhoto } from "../uploads/odometerUploads";
import {
  listVerificationOutbox,
  markVerificationQueueItemDone,
  markVerificationQueueItemRetry,
} from "./outbox";

export interface VerificationSyncResult {
  processed: number;
  failed: number;
}

export async function flushVerificationOutbox(): Promise<VerificationSyncResult> {
  const queue = await listVerificationOutbox();
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.kind === "metadata") {
        const res = await saveTripVerification(item.payload);
        if (res.error) throw res.error;
      } else {
        if (!item.payload.userId) throw new Error("User missing for photo upload");
        const res = await uploadVerificationPhoto({
          tripId: item.payload.tripId,
          side: item.payload.side,
          localUri: item.payload.localUri,
          userId: item.payload.userId,
        });
        if (res.error) throw res.error;
      }
      await markVerificationQueueItemDone(item.id);
      processed += 1;
    } catch (e) {
      failed += 1;
      await markVerificationQueueItemRetry(
        item.id,
        e instanceof Error ? e.message : "Sync failed",
      );
    }
  }

  return { processed, failed };
}
