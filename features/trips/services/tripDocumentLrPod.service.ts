/**
 * Batch LR/POD index from trip_documents — replaces retired trip_lrs reads.
 * One IN query (chunked), mapped in memory. No compatibility table/view.
 */
import { supabase } from "@/lib/supabase";
import { expandLR } from "@/lib/utils/lr";
import { parseLrFieldValues } from "@/features/trips/services/lrDocumentOcr.util";
import {
  mostUrgentEwayExpiryLabel,
  parseEwayFieldEntries,
} from "@/features/trips/services/ewayBillFields.util";

/** After trip_documents SELECT uses can_read_trip_document, larger IN-lists
 *  are cheap. Keep a cap so PostgREST URLs stay bounded. */
const TRIP_ID_CHUNK_REST = 40;
/** SECURITY DEFINER batch RPC avoids per-row trip_documents RLS — larger chunks OK. */
const TRIP_ID_CHUNK_RPC = 80;

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
 * The ONE authoritative hard-copy-POD-receipt operation (Phase 4) — every
 * caller (Trip Detail, Log Incoming PODs, the Compliance panel) converges
 * here. Goes through `record_trip_hard_copy_pod` (SECURITY DEFINER,
 * `trip_compliance.pod.manage` enforced server-side), which stamps
 * `trips.pod_received_at` — the same field POD reconciliation, Invoicing's
 * POD-required gate, and Log Incoming PODs' own pending-trips filter already
 * read — so a receipt recorded from any surface is visible to all of them.
 * Idempotent: the RPC no-ops (returns false) on a trip that already has
 * `pod_received_at` set, without touching the original timestamp/actor or
 * writing a duplicate audit event. The timestamp is always server time
 * (`now()` inside the RPC) — never client-supplied, so two callers racing
 * can't disagree about when the trip was actually received.
 */
export async function markTripHardCopyPodReceived(
  tripId: string,
  metadata?: {
    courier?: string | null;
    awbNumber?: string | null;
    receivedBy?: string | null;
    comment?: string | null;
  },
): Promise<{ error: Error | null; alreadyReceived?: boolean }> {
  const id = String(tripId ?? "").trim();
  if (!id) return { error: new Error("Trip is not linked.") };
  const { data, error } = await supabase().rpc("record_trip_hard_copy_pod", {
    p_trip_id: id,
    p_courier: metadata?.courier?.trim() || null,
    p_awb_number: metadata?.awbNumber?.trim() || null,
    p_received_by: metadata?.receivedBy?.trim() || null,
    p_comment: metadata?.comment?.trim() || null,
  });
  if (error) {
    console.error("[tripDocumentLrPod] record_trip_hard_copy_pod:", error);
    return { error: new Error(error.message) };
  }
  return { error: null, alreadyReceived: data === false };
}

export type TripHardCopyPodReceipt = {
  received: boolean;
  receivedAt: string | null;
  courier: string | null;
  awbNumber: string | null;
  receivedBy: string | null;
  comment: string | null;
  actorId: string | null;
};

/** Hard-copy POD workflow status (header badge + sidebar). */
export type HardCopyPodStatus = "PENDING" | "IN_TRANSIT" | "RECEIVED";

export type HardCopyPodReceiptMethod = "person" | "courier";

export type TripHardCopyPodState = {
  status: HardCopyPodStatus;
  receiptMethod: HardCopyPodReceiptMethod | null;
  receivedAt: string | null;
  receivedBy: string | null;
  courier: string | null;
  awbNumber: string | null;
  dispatchDate: string | null;
  expectedDeliveryDate: string | null;
  courierContact: string | null;
  remarks: string | null;
  /** Operator-entered calendar date from comment payload (YYYY-MM-DD), when present. */
  receivedDate: string | null;
  receivedTime: string | null;
  actorId: string | null;
};

type HardCopyPodCommentPayload = {
  v: 1;
  remarks?: string | null;
  received_date?: string | null;
  received_time?: string | null;
  receipt_method?: HardCopyPodReceiptMethod | null;
  dispatch_date?: string | null;
  expected_delivery_date?: string | null;
};

export function resolveHardCopyPodStatus(trip: {
  pod_received_at?: string | null;
  pod_hard_copy_courier?: string | null;
  pod_hard_copy_awb_number?: string | null;
}): HardCopyPodStatus {
  if (trip.pod_received_at) return "RECEIVED";
  const courier = String(trip.pod_hard_copy_courier ?? "").trim();
  const awb = String(trip.pod_hard_copy_awb_number ?? "").trim();
  if (courier || awb) return "IN_TRANSIT";
  return "PENDING";
}

export function encodeHardCopyPodComment(input: {
  remarks?: string | null;
  receivedDate?: string | null;
  receivedTime?: string | null;
  receiptMethod?: HardCopyPodReceiptMethod | null;
  dispatchDate?: string | null;
  expectedDeliveryDate?: string | null;
}): string | null {
  const remarks = String(input.remarks ?? "").trim() || null;
  const receivedDate = String(input.receivedDate ?? "").trim() || null;
  const receivedTime = String(input.receivedTime ?? "").trim() || null;
  const receiptMethod = input.receiptMethod ?? null;
  const dispatchDate = String(input.dispatchDate ?? "").trim() || null;
  const expectedDeliveryDate = String(input.expectedDeliveryDate ?? "").trim() || null;
  if (
    !remarks &&
    !receivedDate &&
    !receivedTime &&
    !receiptMethod &&
    !dispatchDate &&
    !expectedDeliveryDate
  ) {
    return null;
  }
  const payload: HardCopyPodCommentPayload = {
    v: 1,
    remarks,
    received_date: receivedDate,
    received_time: receivedTime,
    receipt_method: receiptMethod,
    dispatch_date: dispatchDate,
    expected_delivery_date: expectedDeliveryDate,
  };
  return JSON.stringify(payload);
}

export function decodeHardCopyPodComment(raw: string | null | undefined): {
  remarks: string | null;
  receivedDate: string | null;
  receivedTime: string | null;
  receiptMethod: HardCopyPodReceiptMethod | null;
  dispatchDate: string | null;
  expectedDeliveryDate: string | null;
} {
  const empty = {
    remarks: null,
    receivedDate: null,
    receivedTime: null,
    receiptMethod: null,
    dispatchDate: null,
    expectedDeliveryDate: null,
  };
  const text = String(raw ?? "").trim();
  if (!text) return empty;
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as HardCopyPodCommentPayload;
      if (parsed && parsed.v === 1) {
        const method = parsed.receipt_method;
        return {
          remarks: String(parsed.remarks ?? "").trim() || null,
          receivedDate: String(parsed.received_date ?? "").trim() || null,
          receivedTime: String(parsed.received_time ?? "").trim() || null,
          receiptMethod:
            method === "person" || method === "courier" ? method : null,
          dispatchDate: String(parsed.dispatch_date ?? "").trim() || null,
          expectedDeliveryDate:
            String(parsed.expected_delivery_date ?? "").trim() || null,
        };
      }
    } catch {
      // plain-text legacy comment
    }
  }
  return { ...empty, remarks: text };
}

/**
 * Log courier hard-copy POD as IN TRANSIT (does not stamp pod_received_at).
 * Mark received later via {@link markTripHardCopyPodReceived}.
 */
export async function logTripHardCopyPodCourier(
  tripId: string,
  input: {
    courier: string;
    awbNumber: string;
    dispatchDate: string;
    expectedDeliveryDate?: string | null;
    courierContact?: string | null;
    remarks?: string | null;
  },
): Promise<{ error: Error | null; alreadyReceived?: boolean }> {
  const id = String(tripId ?? "").trim();
  if (!id) return { error: new Error("Trip is not linked.") };
  const courier = String(input.courier ?? "").trim();
  const awbNumber = String(input.awbNumber ?? "").trim();
  const dispatchDate = String(input.dispatchDate ?? "").trim();
  if (!courier) return { error: new Error("Courier name is required.") };
  if (!awbNumber) return { error: new Error("Tracking / AWB number is required.") };
  if (!dispatchDate) return { error: new Error("Dispatch date is required.") };

  const { data, error } = await supabase().rpc("log_trip_hard_copy_pod_courier", {
    p_trip_id: id,
    p_courier: courier,
    p_awb_number: awbNumber,
    p_dispatch_date: dispatchDate,
    p_expected_delivery_date: String(input.expectedDeliveryDate ?? "").trim() || null,
    p_courier_contact: String(input.courierContact ?? "").trim() || null,
    p_remarks: String(input.remarks ?? "").trim() || null,
  });
  if (error) {
    console.error("[tripDocumentLrPod] log_trip_hard_copy_pod_courier:", error);
    return { error: new Error(error.message) };
  }
  return { error: null, alreadyReceived: data === false };
}

/**
 * Supplementary read for display (Trip Detail's post-receipt state, Phase 4
 * Section 14) — courier/AWB/received-by live on `trips`, the comment lives
 * in the `trip_workflow_events` row the RPC writes (Section 9's preference
 * for reusing existing audit/event storage over a new column).
 */
export async function fetchTripHardCopyPodReceipt(
  tripId: string,
): Promise<{ error: Error | null; receipt: TripHardCopyPodReceipt | null }> {
  const { error, state } = await fetchTripHardCopyPodState(tripId);
  if (error) return { error, receipt: null };
  if (!state) return { error: null, receipt: null };
  return {
    error: null,
    receipt: {
      received: state.status === "RECEIVED",
      receivedAt: state.receivedAt,
      courier: state.courier,
      awbNumber: state.awbNumber,
      receivedBy: state.receivedBy,
      comment: state.remarks,
      actorId: state.actorId,
    },
  };
}

/**
 * Full hard-copy POD state for Manifest Management (PENDING / IN_TRANSIT / RECEIVED).
 */
export async function fetchTripHardCopyPodState(
  tripId: string,
): Promise<{ error: Error | null; state: TripHardCopyPodState | null }> {
  const id = String(tripId ?? "").trim();
  if (!id) return { error: new Error("Trip is not linked."), state: null };

  const { data: trip, error: tripError } = await supabase()
    .from("trips")
    .select("pod_received_at, pod_hard_copy_courier, pod_hard_copy_awb_number, pod_hard_copy_received_by")
    .eq("id", id)
    .maybeSingle();
  if (tripError) return { error: new Error(tripError.message), state: null };
  if (!trip) {
    return {
      error: null,
      state: {
        status: "PENDING",
        receiptMethod: null,
        receivedAt: null,
        receivedBy: null,
        courier: null,
        awbNumber: null,
        dispatchDate: null,
        expectedDeliveryDate: null,
        courierContact: null,
        remarks: null,
        receivedDate: null,
        receivedTime: null,
        actorId: null,
      },
    };
  }

  const courier = (trip.pod_hard_copy_courier as string | null) ?? null;
  const awbNumber = (trip.pod_hard_copy_awb_number as string | null) ?? null;
  const receivedBy = (trip.pod_hard_copy_received_by as string | null) ?? null;
  const receivedAt = (trip.pod_received_at as string | null) ?? null;
  const status = resolveHardCopyPodStatus({
    pod_received_at: receivedAt,
    pod_hard_copy_courier: courier,
    pod_hard_copy_awb_number: awbNumber,
  });

  let remarks: string | null = null;
  let receivedDate: string | null = null;
  let receivedTime: string | null = null;
  let receiptMethod: HardCopyPodReceiptMethod | null = null;
  let dispatchDate: string | null = null;
  let expectedDeliveryDate: string | null = null;
  let courierContact: string | null = null;
  let actorId: string | null = null;

  if (status === "RECEIVED") {
    const { data: event } = await supabase()
      .from("trip_workflow_events")
      .select("payload, actor_id")
      .eq("trip_id", id)
      .eq("event_type", "pod.hard_copy_received")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = (event?.payload ?? {}) as {
      comment?: string | null;
      courier?: string | null;
      awb_number?: string | null;
      received_by?: string | null;
    };
    const decoded = decodeHardCopyPodComment(payload.comment);
    remarks = decoded.remarks;
    receivedDate = decoded.receivedDate;
    receivedTime = decoded.receivedTime;
    dispatchDate = decoded.dispatchDate;
    expectedDeliveryDate = decoded.expectedDeliveryDate;
    receiptMethod =
      decoded.receiptMethod ??
      (courier || awbNumber || payload.courier || payload.awb_number
        ? "courier"
        : receivedBy || payload.received_by
          ? "person"
          : null);
    actorId = (event?.actor_id as string | null) ?? null;

    // Prefer courier dispatch event for dispatch/expected/contact when present.
    if (courier || awbNumber) {
      const { data: dispatchEvent } = await supabase()
        .from("trip_workflow_events")
        .select("payload")
        .eq("trip_id", id)
        .eq("event_type", "pod.hard_copy_courier_dispatched")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const dispatchPayload = (dispatchEvent?.payload ?? {}) as {
        dispatch_date?: string | null;
        expected_delivery_date?: string | null;
        courier_contact?: string | null;
        remarks?: string | null;
      };
      dispatchDate =
        String(dispatchPayload.dispatch_date ?? "").trim() || dispatchDate;
      expectedDeliveryDate =
        String(dispatchPayload.expected_delivery_date ?? "").trim() ||
        expectedDeliveryDate;
      courierContact = String(dispatchPayload.courier_contact ?? "").trim() || null;
      if (!remarks && dispatchPayload.remarks) {
        remarks = String(dispatchPayload.remarks).trim() || null;
      }
    }
  } else if (status === "IN_TRANSIT") {
    receiptMethod = "courier";
    const { data: dispatchEvent } = await supabase()
      .from("trip_workflow_events")
      .select("payload, actor_id")
      .eq("trip_id", id)
      .eq("event_type", "pod.hard_copy_courier_dispatched")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dispatchPayload = (dispatchEvent?.payload ?? {}) as {
      dispatch_date?: string | null;
      expected_delivery_date?: string | null;
      courier_contact?: string | null;
      remarks?: string | null;
    };
    dispatchDate = String(dispatchPayload.dispatch_date ?? "").trim() || null;
    expectedDeliveryDate =
      String(dispatchPayload.expected_delivery_date ?? "").trim() || null;
    courierContact = String(dispatchPayload.courier_contact ?? "").trim() || null;
    remarks = String(dispatchPayload.remarks ?? "").trim() || null;
    actorId = (dispatchEvent?.actor_id as string | null) ?? null;
  }

  return {
    error: null,
    state: {
      status,
      receiptMethod,
      receivedAt,
      receivedBy,
      courier,
      awbNumber,
      dispatchDate,
      expectedDeliveryDate,
      courierContact,
      remarks,
      receivedDate,
      receivedTime,
      actorId,
    },
  };
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

function chunkIds(ids: string[], chunkSize: number): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize));
  }
  return chunks;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isTripUuid(id: string): boolean {
  return UUID_RE.test(id);
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

async function fetchLrPodRowsViaRpc(
  tripIds: string[],
): Promise<TripDocumentLrPodRow[] | null> {
  const uuidIds = tripIds.filter(isTripUuid);
  // Non-UUID ids (tests / legacy) → REST path. Empty uuid set is not "RPC ok".
  if (uuidIds.length === 0) return null;
  const chunks = chunkIds(uuidIds, TRIP_ID_CHUNK_RPC);
  try {
    const parts = await runWithConcurrencyLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase().rpc(
        "get_trip_documents_lr_pod_batch",
        { p_trip_ids: chunk },
      );
      if (error) {
        // Missing RPC / permission → fall back to REST path for the whole call.
        throw error;
      }
      return (data ?? []) as TripDocumentLrPodRow[];
    });
    const rows: TripDocumentLrPodRow[] = [];
    for (const part of parts) rows.push(...part);
    return rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[tripDocumentLrPod] lr/pod RPC batch unavailable:", msg);
    return null;
  }
}

async function fetchLrPodRowsViaRest(
  tripIds: string[],
  documentTypes: string[],
): Promise<TripDocumentLrPodRow[]> {
  const chunks = chunkIds(tripIds, TRIP_ID_CHUNK_REST);
  if (chunks.length === 0) return [];
  const results = await runWithConcurrencyLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
    try {
      const { data, error } = await supabase()
        .from("trip_documents")
        .select("trip_id, document_type, document_number")
        .in("trip_id", chunk)
        .in("document_type", documentTypes);
      if (error) {
        console.warn("[tripDocumentLrPod] trip_documents fetch:", error.message);
        return [] as TripDocumentLrPodRow[];
      }
      return (data ?? []) as TripDocumentLrPodRow[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[tripDocumentLrPod] trip_documents fetch:", msg);
      return [] as TripDocumentLrPodRow[];
    }
  });
  const rows: TripDocumentLrPodRow[] = [];
  for (const part of results) rows.push(...part);
  return rows;
}

/** One bulk read of LR + POD metadata for many trips. */
export async function loadLrPodIndexByTripIds(
  tripIds: string[],
): Promise<Map<string, TripLrPodIndex>> {
  const unique = Array.from(new Set(tripIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const viaRpc = await fetchLrPodRowsViaRpc(unique);
  const rows =
    viaRpc ??
    (await fetchLrPodRowsViaRest(unique, ["lr", "pod", "soft_pod", "pod_soft"]));
  return indexLrPodDocuments(rows);
}

export type HubPodReceiptFlags = {
  softTripIds: string[];
  hardTripIds: string[];
  /** Soonest e-way bill expiry label, keyed by lowercased trip id. */
  ewayExpiryByTripId: Record<string, string>;
};

/**
 * Pulse hub digital-POD chip: trip_documents document_type pod (chunked).
 * Prefers SECURITY DEFINER batch RPC; falls back to REST. Hard-copy chips use
 * already-loaded trips.pod_received_at — do not re-select trips for that stamp.
 */
export async function loadHubPodReceiptFlags(
  tripIds: string[],
): Promise<HubPodReceiptFlags> {
  const wanted = Array.from(
    new Set(tripIds.map((id) => normalizeTripPodId(id)).filter(Boolean)),
  );
  if (wanted.length === 0) {
    return { softTripIds: [], hardTripIds: [], ewayExpiryByTripId: {} };
  }

  const soft = new Set<string>();
  const ewayTillsByTrip = new Map<string, string[]>();
  const viaRpc = await fetchLrPodRowsViaRpc(wanted);
  const rows =
    viaRpc ??
    (await fetchLrPodRowsViaRest(wanted, ["pod", "soft_pod", "pod_soft", "eway_bill"]));

  for (const row of rows) {
    const id = normalizeTripPodId(row.trip_id);
    if (!id) continue;
    if (isSoftPodDocumentType(row.document_type)) {
      soft.add(id);
      continue;
    }
    if (String(row.document_type ?? "").trim().toLowerCase() !== "eway_bill") {
      continue;
    }
    const tills = parseEwayFieldEntries(row.document_number)
      .map((entry) => entry.validTill)
      .filter((value) => value.trim().length > 0);
    if (tills.length === 0) continue;
    const existing = ewayTillsByTrip.get(id) ?? [];
    existing.push(...tills);
    ewayTillsByTrip.set(id, existing);
  }

  const ewayExpiryByTripId: Record<string, string> = {};
  for (const [id, tills] of ewayTillsByTrip) {
    const label = mostUrgentEwayExpiryLabel(tills);
    if (label) ewayExpiryByTripId[id] = label;
  }

  return { softTripIds: [...soft], hardTripIds: [], ewayExpiryByTripId };
}

/** Header tag for one trip. The detail bundle does not include document_number. */
export async function loadTripEwayExpiryLabel(
  tripId: string,
): Promise<string | null> {
  const id = tripId.trim();
  if (!id) return null;
  const { data, error } = await supabase()
    .from("trip_documents")
    .select("document_number")
    .eq("trip_id", id)
    .eq("document_type", "eway_bill");
  if (error || !data?.length) return null;
  const tills = data.flatMap((row) =>
    parseEwayFieldEntries(row.document_number).map((entry) => entry.validTill),
  );
  return mostUrgentEwayExpiryLabel(tills);
}
