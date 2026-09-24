import { createTripFuelEntry, uploadFuelBillPhoto } from "../fuel/fuel.service";
import { createTripTollEntry, uploadTollReceiptPhoto } from "../toll/toll.service";
import { compressOperationsPhoto } from "../uploads/photoUploads";
import { appendTripOperationalTimelineEventSafe } from "../timeline/timelineEvents.service";
import {
  listOperationsOutbox,
  markOperationsQueueItemDone,
  markOperationsQueueItemRetry,
} from "./outbox";

export interface OperationsSyncResult {
  processed: number;
  failed: number;
  processedTripIds: string[];
  failedTripIds: string[];
}

export async function flushOperationsOutbox(): Promise<OperationsSyncResult> {
  const queue = await listOperationsOutbox();
  let processed = 0;
  let failed = 0;
  const processedTripIds = new Set<string>();
  const failedTripIds = new Set<string>();

  for (const item of queue) {
    try {
      const tripId =
        item.kind === "fuel_metadata" ||
        item.kind === "toll_metadata" ||
        item.kind === "fuel_photo" ||
        item.kind === "toll_photo"
          ? item.payload.tripId
          : null;
      if (item.kind === "fuel_metadata") {
        const res = await createTripFuelEntry({ ...item.payload, queueItemId: item.id });
        if (res.error) throw res.error;
      } else if (item.kind === "toll_metadata") {
        const res = await createTripTollEntry({ ...item.payload, queueItemId: item.id });
        if (res.error) throw res.error;
      } else if (item.kind === "fuel_photo") {
        if (!item.payload.userId) throw new Error("User missing for fuel photo sync");
        const arrayBuffer = await compressOperationsPhoto(item.payload.localUri);
        const upload = await uploadFuelBillPhoto({
          tripId: item.payload.tripId,
          userId: item.payload.userId,
          arrayBuffer,
          fileName: `fuel-bill-${Date.now()}.jpg`,
        });
        if (upload.error) throw upload.error;
      } else {
        if (!item.payload.userId) throw new Error("User missing for toll receipt sync");
        const arrayBuffer = await compressOperationsPhoto(item.payload.localUri);
        const upload = await uploadTollReceiptPhoto({
          tripId: item.payload.tripId,
          userId: item.payload.userId,
          arrayBuffer,
          fileName: `toll-receipt-${Date.now()}.jpg`,
        });
        if (upload.error) throw upload.error;
      }
      await markOperationsQueueItemDone(item.id);
      processed += 1;
      if (tripId) {
        processedTripIds.add(tripId);
        await appendTripOperationalTimelineEventSafe({
          tripId,
          eventType: "replay_completed",
          sourceType: "sync",
          sourceId: item.id,
          actorUserId: null,
          payload: { itemKind: item.kind },
        });
      }
    } catch (e) {
      failed += 1;
      await markOperationsQueueItemRetry(
        item.id,
        e instanceof Error ? e.message : "Operations sync failed",
      );
      const tripId =
        item.kind === "fuel_metadata" ||
        item.kind === "toll_metadata" ||
        item.kind === "fuel_photo" ||
        item.kind === "toll_photo"
          ? item.payload.tripId
          : null;
      if (tripId) {
        failedTripIds.add(tripId);
        await appendTripOperationalTimelineEventSafe({
          tripId,
          eventType: "replay_failed",
          sourceType: "sync",
          sourceId: item.id,
          actorUserId: null,
          payload: {
            itemKind: item.kind,
            reason: e instanceof Error ? e.message : "Operations sync failed",
          },
        });
      }
    }
  }

  return {
    processed,
    failed,
    processedTripIds: Array.from(processedTripIds),
    failedTripIds: Array.from(failedTripIds),
  };
}
