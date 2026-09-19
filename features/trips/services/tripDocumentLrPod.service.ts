/**
 * Batch LR/POD index from trip_documents — replaces retired trip_lrs reads.
 * One IN query (chunked), mapped in memory. No compatibility table/view.
 */
import { supabase } from "@/lib/supabase";
import { expandLR } from "@/lib/utils/lr";
import { parseLrFieldValues } from "@/features/trips/services/lrDocumentOcr.util";

/** Keep IN-lists short — 200 UUIDs overflow typical 8kb gateway URL limits and return []. */
const TRIP_ID_CHUNK = 40;

export type TripDocumentLrPodRow = {
  trip_id: string;
  document_type: string;
  document_number?: string | null;
};

export type TripLrPodIndex = {
  lrNumbers: string[];
  hasPodDocument: boolean;
};

function lrNumberFromDocument(documentNumber: string | null | undefined): string[] {
  const parsed = parseLrFieldValues(documentNumber).lrNumber;
  return parsed ? expandLR(parsed) : [];
}

export function indexLrPodDocuments(
  rows: TripDocumentLrPodRow[],
): Map<string, TripLrPodIndex> {
  const byTrip = new Map<string, TripLrPodIndex>();
  for (const row of rows) {
    const tripId = normalizeTripPodId(row.trip_id);
    if (!tripId) continue;
    const current = byTrip.get(tripId) ?? {
      lrNumbers: [],
      hasPodDocument: false,
    };
    const type = String(row.document_type ?? "").trim().toLowerCase();
    if (type === "lr") {
      current.lrNumbers.push(...lrNumberFromDocument(row.document_number));
    } else if (isSoftPodDocumentType(type)) {
      current.hasPodDocument = true;
    }
    byTrip.set(tripId, current);
  }
  for (const index of byTrip.values()) {
    index.lrNumbers = Array.from(new Set(index.lrNumbers.filter(Boolean)));
  }
  return byTrip;
}

export function tripPodIsReceived(trip: {
  pod_received_at?: string | null;
  pod_status?: unknown;
}): boolean {
  if (trip.pod_received_at) return true;
  return String(trip.pod_status ?? "").toLowerCase() === "received";
}

/** Digital/soft-copy POD: at least one trip_documents row with document_type = pod. */
export function normalizeTripPodId(id: string | null | undefined): string {
  return String(id ?? "").trim().toLowerCase();
}

export function tripHasHubPodFlag(
  flags: Set<string> | undefined,
  tripId: string | null | undefined,
): boolean {
  const id = normalizeTripPodId(tripId);
  return Boolean(id) && Boolean(flags?.has(id));
}

export function isSoftPodDocumentType(documentType: string | null | undefined): boolean {
  const type = String(documentType ?? "").trim().toLowerCase();
  return type === "pod" || type === "soft_pod" || type === "pod_soft";
}

export function tripHasSoftCopyPod(hasPodDocument: boolean | null | undefined): boolean {
  return Boolean(hasPodDocument);
}

/** Physical/hard-copy POD: trips.pod_received_at (same as {@link tripPodIsReceived}). */
export function tripHasHardCopyPod(trip: {
  pod_received_at?: string | null;
  pod_status?: unknown;
}): boolean {
  return tripPodIsReceived(trip);
}

/** POD chips belong on delivered/completed trips only, not in-transit. */
export function tripIsDeliveredStatus(
  status?: string | null,
  stageLabel?: string | null,
): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (s === "completed" || s === "delivered" || s === "done") return true;
  const stage = String(stageLabel ?? "").trim().toUpperCase();
  return stage === "COMPLETED" || stage === "DELIVERED" || stage === "DONE";
}

export type TripCompletionListFilter = "all" | "completed" | "not_completed";

export function tripMatchesCompletionFilter(
  filter: TripCompletionListFilter,
  status?: string | null,
  stageLabel?: string | null,
): boolean {
  if (filter === "all") return true;
  const completed = tripIsDeliveredStatus(status, stageLabel);
  return filter === "completed" ? completed : !completed;
}

export function countTripsByCompletion<T>(
  trips: T[],
  statusOf: (trip: T) => string | null | undefined,
): { completed: number; notCompleted: number } {
  let completed = 0;
  let notCompleted = 0;
  for (const trip of trips) {
    if (tripIsDeliveredStatus(statusOf(trip))) completed += 1;
    else notCompleted += 1;
  }
  return { completed, notCompleted };
}

export function tripPodStatusFlags(args: {
  hasPodDocument?: boolean | null;
  pod_received_at?: string | null;
  pod_status?: unknown;
}): { softCopyReceived: boolean; hardCopyReceived: boolean } {
  return {
    softCopyReceived: tripHasSoftCopyPod(args.hasPodDocument),
    hardCopyReceived: tripHasHardCopyPod({
      pod_received_at: args.pod_received_at,
      pod_status: args.pod_status,
    }),
  };
}

/**
 * Mark physical POD received — same write as the Log Incoming POD flow.
 * Timestamp is ISO now unless a received-at is supplied (preserve caller semantics).
 */
export async function markTripHardCopyPodReceived(
  tripInternalId: string,
  receivedAt: string = new Date().toISOString(),
): Promise<{ error: Error | null }> {
  const id = String(tripInternalId ?? "").trim();
  if (!id) return { error: new Error("Trip is not linked.") };
  const { data, error } = await supabase()
    .from("trips")
    .update({ pod_received_at: receivedAt })
    .eq("id", id)
    .select("id, pod_received_at")
    .maybeSingle();
  if (error) {
    console.error("[tripDocumentLrPod] pod_received_at update:", error);
    return { error: new Error(error.message) };
  }
  if (!data?.id) {
    return {
      error: new Error("Could not stamp hard-copy POD on this trip."),
    };
  }
  return { error: null };
}

export function receivedLrNumbersForTrip(
  lrNumbers: string[],
  opts: { tripReceived: boolean; hasPodDocument: boolean },
): string[] {
  if (opts.tripReceived || opts.hasPodDocument) {
    return [...lrNumbers];
  }
  return [];
}

function chunkIds(ids: string[]): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += TRIP_ID_CHUNK) {
    chunks.push(unique.slice(i, i + TRIP_ID_CHUNK));
  }
  return chunks;
}

/** Max simultaneous `trip_documents`/`trips` chunk queries per call — large orgs can
 *  otherwise produce dozens of chunks (e.g. 3000 ids / 40 = 75), firing that many
 *  connections at once via `Promise.all`. */
const CHUNK_CONCURRENCY = 3;

/**
 * Runs `worker` over `items` with at most `limit` in flight at once. Every item is
 * processed and one result is returned per item, in input order — `worker` is expected
 * to catch its own errors (as all call sites below already do), so a single item's
 * failure never rejects the overall call.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runNext(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]!, index);
    }
  }
  const workerCount = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

/** One bulk read of LR + POD metadata for many trips. */
export async function loadLrPodIndexByTripIds(
  tripIds: string[],
): Promise<Map<string, TripLrPodIndex>> {
  const chunks = chunkIds(tripIds);
  if (chunks.length === 0) return new Map();

  const rows: TripDocumentLrPodRow[] = [];
  const results = await runWithConcurrencyLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    const { data, error } = await supabase()
      .from("trip_documents")
      .select("trip_id, document_type, document_number")
      .in("trip_id", chunk)
      .in("document_type", ["lr", "pod", "soft_pod", "pod_soft"]);
    if (error) {
      console.warn("[tripDocumentLrPod] trip_documents fetch:", error.message);
      return [] as TripDocumentLrPodRow[];
    }
    return (data ?? []) as TripDocumentLrPodRow[];
  });
  for (const part of results) rows.push(...part);
  return indexLrPodDocuments(rows);
}

export type HubPodReceiptFlags = {
  softTripIds: string[];
  hardTripIds: string[];
};

/**
 * Pulse hub digital-POD chip: trip_documents document_type pod (chunked,
 * sequential). Hard-copy chips use already-loaded trips.pod_received_at —
 * do not re-select trips for that stamp.
 */
export async function loadHubPodReceiptFlags(
  tripIds: string[],
): Promise<HubPodReceiptFlags> {
  const wanted = Array.from(
    new Set(tripIds.map((id) => normalizeTripPodId(id)).filter(Boolean)),
  );
  if (wanted.length === 0) return { softTripIds: [], hardTripIds: [] };

  const chunks = chunkIds(wanted);
  const soft = new Set<string>();

  const docParts = await runWithConcurrencyLimit(chunks, 1, async (chunk) => {
    const { data, error } = await supabase()
      .from("trip_documents")
      .select("trip_id, document_type")
      .in("trip_id", chunk)
      .in("document_type", ["pod", "soft_pod", "pod_soft"]);
    if (error) {
      console.warn("[tripDocumentLrPod] hub soft POD fetch:", error.message);
      return [] as TripDocumentLrPodRow[];
    }
    return (data ?? []) as TripDocumentLrPodRow[];
  });
  for (const part of docParts) {
    for (const row of part) {
      if (!isSoftPodDocumentType(row.document_type)) continue;
      const id = normalizeTripPodId(row.trip_id);
      if (id) soft.add(id);
    }
  }

  return { softTripIds: [...soft], hardTripIds: [] };
}
