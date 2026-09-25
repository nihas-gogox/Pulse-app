import { getTripById, getTripsByIds } from "../../../trips/services/trips.service";
import {
  getTripFuelEntries,
  getTripFuelEntriesForTrips,
  updateTripFuelApprovalState,
} from "../../../trips/operations/fuel/fuel.service";
import {
  getTripTollEntries,
  getTripTollEntriesForTrips,
  updateTripTollApprovalState,
} from "../../../trips/operations/toll/toll.service";
import { getTripOperationalCapabilities } from "../../../trips/capabilities";
import { supabase } from "@pulse/core/lib/supabase";
import { executeVehiclePostingRuntime } from "../runtime";

type SourceType = "fuel" | "toll";

export type ReconciliationChip =
  | "posted"
  | "awaiting_posting"
  | "retry_needed"
  | "reconciliation_required"
  | "blocked";

export interface PostingMismatch {
  sourceType: SourceType;
  sourceId: string;
  postingState: string;
  ledgerState: string;
  shouldPost: boolean;
  hasLedgerEntry: boolean;
}

function shouldEntryPost(input: {
  approvalState: string | null | undefined;
  paymentOwner: string | null | undefined;
  isAssetTrip: boolean;
}): boolean {
  if (!input.isAssetTrip) return false;
  if (String(input.approvalState ?? "") !== "approved") return false;
  const owner = String(input.paymentOwner ?? "").toLowerCase();
  return owner === "organization" || owner === "fleet_card";
}

export async function detectPostingMismatch(input: {
  sourceType: SourceType;
  sourceId: string;
  postingState: string | null | undefined;
  ledgerState: string | null | undefined;
  shouldPost: boolean;
}): Promise<PostingMismatch> {
  const existing = await supabase()
    .from("vehicle_ledger_entries")
    .select("id")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    postingState: String(input.postingState ?? "pending"),
    ledgerState: String(input.ledgerState ?? "not_posted"),
    shouldPost: input.shouldPost,
    hasLedgerEntry: !!existing.data?.id,
  };
}

export async function reconcileVehicleLedgerState(input: {
  tripId: string;
}): Promise<{ error: Error | null; mismatches: PostingMismatch[]; chip: ReconciliationChip }> {
  const [tripRes, fuelRes, tollRes] = await Promise.all([
    getTripById(input.tripId),
    getTripFuelEntries(input.tripId),
    getTripTollEntries(input.tripId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip not found"), mismatches: [], chip: "blocked" };
  }
  if (fuelRes.error) return { error: fuelRes.error, mismatches: [], chip: "blocked" };
  if (tollRes.error) return { error: tollRes.error, mismatches: [], chip: "blocked" };
  const capabilities = getTripOperationalCapabilities(tripRes.trip);
  const candidates = [
    ...fuelRes.entries.map((entry) => ({
      sourceType: "fuel" as const,
      sourceId: entry.id,
      postingState: entry.posting_state,
      ledgerState: entry.ledger_state,
      shouldPost: shouldEntryPost({
        approvalState: entry.approval_state,
        paymentOwner: entry.payment_owner,
        isAssetTrip: capabilities.isAssetTrip,
      }),
    })),
    ...tollRes.entries.map((entry) => ({
      sourceType: "toll" as const,
      sourceId: entry.id,
      postingState: entry.posting_state,
      ledgerState: entry.ledger_state,
      shouldPost: shouldEntryPost({
        approvalState: entry.approval_state,
        paymentOwner: entry.payment_owner,
        isAssetTrip: capabilities.isAssetTrip,
      }),
    })),
  ];
  const mismatches: PostingMismatch[] = [];
  for (const candidate of candidates) {
    const mismatch = await detectPostingMismatch(candidate);
    const invariantBroken =
      (mismatch.shouldPost && !mismatch.hasLedgerEntry) ||
      (!mismatch.shouldPost && mismatch.hasLedgerEntry && !capabilities.isAssetTrip) ||
      (mismatch.hasLedgerEntry && mismatch.postingState !== "posted");
    if (invariantBroken) mismatches.push(mismatch);
  }
  const chip: ReconciliationChip =
    mismatches.length === 0
      ? "posted"
      : mismatches.some((m) => m.postingState === "failed")
        ? "retry_needed"
        : mismatches.some((m) => m.shouldPost)
          ? "reconciliation_required"
          : "awaiting_posting";
  return { error: null, mismatches, chip };
}

/**
 * Batched existence check for vehicle_ledger_entries, replacing one detectPostingMismatch
 * call per candidate with up to 2 calls total (one per source_type actually present).
 */
async function fetchExistingLedgerEntryKeys(
  candidates: Array<{ sourceType: SourceType; sourceId: string }>,
): Promise<Set<string>> {
  const existing = new Set<string>();
  const idsByType: Record<SourceType, string[]> = { fuel: [], toll: [] };
  for (const c of candidates) idsByType[c.sourceType].push(c.sourceId);

  await Promise.all(
    (Object.keys(idsByType) as SourceType[])
      .filter((sourceType) => idsByType[sourceType].length > 0)
      .map(async (sourceType) => {
        const { data } = await supabase()
          .from("vehicle_ledger_entries")
          .select("source_type, source_id")
          .eq("source_type", sourceType)
          .in("source_id", idsByType[sourceType]);
        for (const row of (data ?? []) as { source_type: string; source_id: string }[]) {
          existing.add(`${row.source_type}:${row.source_id}`);
        }
      }),
  );
  return existing;
}

/**
 * Batched form of reconcileVehicleLedgerState — same per-trip mismatch/chip rules,
 * but fetches trips/fuel/toll/ledger-entries in 4 total calls instead of 3N+C.
 * Mirrors reconcileVehicleLedgerState's logic exactly; kept as a separate function
 * (rather than sharing code) so the existing single-trip path is untouched.
 */
export async function reconcileVehicleLedgerStatesBatch(
  tripIds: string[],
): Promise<
  Map<string, { error: Error | null; mismatches: PostingMismatch[]; chip: ReconciliationChip }>
> {
  const results = new Map<
    string,
    { error: Error | null; mismatches: PostingMismatch[]; chip: ReconciliationChip }
  >();
  if (tripIds.length === 0) return results;

  const [tripsRes, fuelRes, tollRes] = await Promise.all([
    getTripsByIds(tripIds),
    getTripFuelEntriesForTrips(tripIds),
    getTripTollEntriesForTrips(tripIds),
  ]);
  const tripsById = new Map(tripsRes.trips.map((t) => [t.id, t]));

  type Candidate = {
    sourceType: SourceType;
    sourceId: string;
    postingState: string | null | undefined;
    ledgerState: string | null | undefined;
    shouldPost: boolean;
  };
  const candidatesByTrip = new Map<
    string,
    { isAssetTrip: boolean; candidates: Candidate[] }
  >();
  const allCandidates: Array<{ sourceType: SourceType; sourceId: string }> = [];

  for (const tripId of tripIds) {
    const trip = tripsById.get(tripId);
    if (tripsRes.error || !trip) {
      results.set(tripId, {
        error: tripsRes.error ?? new Error("Trip not found"),
        mismatches: [],
        chip: "blocked",
      });
      continue;
    }
    if (fuelRes.error) {
      results.set(tripId, { error: fuelRes.error, mismatches: [], chip: "blocked" });
      continue;
    }
    if (tollRes.error) {
      results.set(tripId, { error: tollRes.error, mismatches: [], chip: "blocked" });
      continue;
    }
    const capabilities = getTripOperationalCapabilities(trip);
    const candidates: Candidate[] = [
      ...(fuelRes.entriesByTripId[tripId] ?? []).map((entry) => ({
        sourceType: "fuel" as const,
        sourceId: entry.id,
        postingState: entry.posting_state,
        ledgerState: entry.ledger_state,
        shouldPost: shouldEntryPost({
          approvalState: entry.approval_state,
          paymentOwner: entry.payment_owner,
          isAssetTrip: capabilities.isAssetTrip,
        }),
      })),
      ...(tollRes.entriesByTripId[tripId] ?? []).map((entry) => ({
        sourceType: "toll" as const,
        sourceId: entry.id,
        postingState: entry.posting_state,
        ledgerState: entry.ledger_state,
        shouldPost: shouldEntryPost({
          approvalState: entry.approval_state,
          paymentOwner: entry.payment_owner,
          isAssetTrip: capabilities.isAssetTrip,
        }),
      })),
    ];
    candidatesByTrip.set(tripId, { isAssetTrip: capabilities.isAssetTrip, candidates });
    for (const c of candidates) allCandidates.push({ sourceType: c.sourceType, sourceId: c.sourceId });
  }

  const existingKeys = await fetchExistingLedgerEntryKeys(allCandidates);

  for (const [tripId, { isAssetTrip, candidates }] of candidatesByTrip) {
    const mismatches: PostingMismatch[] = [];
    for (const candidate of candidates) {
      const hasLedgerEntry = existingKeys.has(`${candidate.sourceType}:${candidate.sourceId}`);
      const mismatch: PostingMismatch = {
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        postingState: String(candidate.postingState ?? "pending"),
        ledgerState: String(candidate.ledgerState ?? "not_posted"),
        shouldPost: candidate.shouldPost,
        hasLedgerEntry,
      };
      const invariantBroken =
        (mismatch.shouldPost && !mismatch.hasLedgerEntry) ||
        (!mismatch.shouldPost && mismatch.hasLedgerEntry && !isAssetTrip) ||
        (mismatch.hasLedgerEntry && mismatch.postingState !== "posted");
      if (invariantBroken) mismatches.push(mismatch);
    }
    const chip: ReconciliationChip =
      mismatches.length === 0
        ? "posted"
        : mismatches.some((m) => m.postingState === "failed")
          ? "retry_needed"
          : mismatches.some((m) => m.shouldPost)
            ? "reconciliation_required"
            : "awaiting_posting";
    results.set(tripId, { error: null, mismatches, chip });
  }

  return results;
}

export async function rebuildOperationalLedgerState(input: {
  tripId: string;
}): Promise<{ error: Error | null; updated: number }> {
  const recon = await reconcileVehicleLedgerState({ tripId: input.tripId });
  if (recon.error) return { error: recon.error, updated: 0 };
  let updated = 0;
  for (const mismatch of recon.mismatches) {
    if (mismatch.sourceType === "fuel") {
      const state = mismatch.hasLedgerEntry ? "posted" : mismatch.shouldPost ? "not_posted" : "void";
      const res = await updateTripFuelApprovalState({
        entryId: mismatch.sourceId,
        approvalState: "approved",
        ledgerState: state,
      });
      if (!res.error) updated += 1;
    } else {
      const state = mismatch.hasLedgerEntry ? "posted" : mismatch.shouldPost ? "not_posted" : "void";
      const res = await updateTripTollApprovalState({
        entryId: mismatch.sourceId,
        approvalState: "approved",
        ledgerState: state,
      });
      if (!res.error) updated += 1;
    }
  }
  return { error: null, updated };
}

export async function reconcileOperationalPosting(input: {
  tripId: string;
  actorUserId: string | null;
}): Promise<{ error: Error | null; posted: number; failed: number; chip: ReconciliationChip }> {
  const [tripRes, fuelRes, tollRes] = await Promise.all([
    getTripById(input.tripId),
    getTripFuelEntries(input.tripId),
    getTripTollEntries(input.tripId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip missing"), posted: 0, failed: 0, chip: "blocked" };
  }
  if (fuelRes.error) return { error: fuelRes.error, posted: 0, failed: 0, chip: "blocked" };
  if (tollRes.error) return { error: tollRes.error, posted: 0, failed: 0, chip: "blocked" };
  let posted = 0;
  let failed = 0;
  for (const entry of fuelRes.entries) {
    const shouldPost = shouldEntryPost({
      approvalState: entry.approval_state,
      paymentOwner: entry.payment_owner,
      isAssetTrip: getTripOperationalCapabilities(tripRes.trip).isAssetTrip,
    });
    if (!shouldPost) continue;
    const post = await executeVehiclePostingRuntime({
      orgId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      vehicleId: tripRes.trip.vehicle_id ?? "",
      sourceType: "fuel",
      sourceId: entry.id,
      amount: Number(entry.amount_inr ?? 0),
      approvedBy: input.actorUserId,
      approvalState: entry.approval_state,
      paymentOwner: entry.payment_owner,
      metadata: { reconciliation: true },
    });
    if (post.error) failed += 1;
    if (post.posted) posted += 1;
  }
  for (const entry of tollRes.entries) {
    const shouldPost = shouldEntryPost({
      approvalState: entry.approval_state,
      paymentOwner: entry.payment_owner,
      isAssetTrip: getTripOperationalCapabilities(tripRes.trip).isAssetTrip,
    });
    if (!shouldPost) continue;
    const post = await executeVehiclePostingRuntime({
      orgId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      vehicleId: tripRes.trip.vehicle_id ?? "",
      sourceType: "toll",
      sourceId: entry.id,
      amount: Number(entry.amount_inr ?? 0),
      approvedBy: input.actorUserId,
      approvalState: entry.approval_state,
      paymentOwner: entry.payment_owner,
      metadata: { reconciliation: true },
    });
    if (post.error) failed += 1;
    if (post.posted) posted += 1;
  }
  const chip: ReconciliationChip =
    failed > 0 ? "retry_needed" : posted > 0 ? "posted" : "awaiting_posting";
  return { error: null, posted, failed, chip };
}
