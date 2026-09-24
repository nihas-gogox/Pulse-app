import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VerificationSide } from "../../../../../../features/trips/verification/types";

const OUTBOX_KEY = "trip_verification_outbox_v1";

type QueueStatus = "pending" | "retrying" | "failed";

interface QueueBase {
  id: string;
  createdAt: string;
  retryCount: number;
  status: QueueStatus;
  lastError: string | null;
}

export interface VerificationMetadataQueueItem extends QueueBase {
  kind: "metadata";
  payload: {
    tripId: string;
    side: VerificationSide;
    odometerKm: number | null;
    gpsDistanceKm: number | null;
    notes: string | null;
    updatedBy: string | null;
    markBusinessVerified?: boolean;
  };
}

export interface VerificationPhotoQueueItem extends QueueBase {
  kind: "photo";
  payload: {
    tripId: string;
    side: VerificationSide;
    localUri: string;
    userId: string | null;
  };
}

export type VerificationQueueItem =
  | VerificationMetadataQueueItem
  | VerificationPhotoQueueItem;

function randomId(): string {
  return `verif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<VerificationQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VerificationQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: VerificationQueueItem[]) {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export async function listVerificationOutbox() {
  return readQueue();
}

export async function enqueueVerificationMetadata(
  payload: VerificationMetadataQueueItem["payload"],
): Promise<string> {
  const queue = await readQueue();
  const id = randomId();
  queue.push({
    id,
    kind: "metadata",
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
    lastError: null,
  });
  await writeQueue(queue);
  return id;
}

export async function enqueueVerificationPhoto(
  payload: VerificationPhotoQueueItem["payload"],
): Promise<string> {
  const queue = await readQueue();
  const id = randomId();
  queue.push({
    id,
    kind: "photo",
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
    lastError: null,
  });
  await writeQueue(queue);
  return id;
}

export async function markVerificationQueueItemDone(id: string) {
  const queue = await readQueue();
  const next = queue.filter((item) => item.id !== id);
  await writeQueue(next);
}

export async function markVerificationQueueItemRetry(
  id: string,
  message: string,
) {
  const queue = await readQueue();
  const next: VerificationQueueItem[] = queue.map((item) => {
    if (item.id !== id) return item;
    const status: QueueStatus = item.retryCount + 1 >= 3 ? "failed" : "retrying";
    return {
      ...item,
      retryCount: item.retryCount + 1,
      status,
      lastError: message,
    };
  });
  await writeQueue(next);
}
