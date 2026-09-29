import { supabase } from "@/lib/supabase";
import {
  lrNumberFromStoredDocumentNumber,
  normalizeOrgLrNumber,
} from "@/features/trips/services/orgLrNumber.util";

const TRIP_ID_CHUNK = 80;

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += TRIP_ID_CHUNK) {
    chunks.push(ids.slice(i, i + TRIP_ID_CHUNK));
  }
  return chunks;
}

/**
 * Same LR number on another trip in this organization. Same trip is allowed
 * (replace / extra files). Other organizations may reuse the number.
 */
export async function findOrgDuplicateLrNumber(input: {
  organizationId: string;
  lrNumber: string;
  excludeTripId?: string | null;
}): Promise<{ tripId: string } | null> {
  const organizationId = input.organizationId.trim();
  const wanted = normalizeOrgLrNumber(input.lrNumber);
  const excludeTripId = (input.excludeTripId ?? "").trim();
  if (!organizationId || !wanted) return null;

  let tripQuery = supabase()
    .from("trips")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const { data: tripRows, error: tripError } = await tripQuery;
  if (tripError || !tripRows?.length) return null;

  const tripIds = tripRows
    .map((row) => String((row as { id?: string }).id ?? "").trim())
    .filter((id) => id && id !== excludeTripId);
  if (tripIds.length === 0) return null;

  for (const chunk of chunkIds(tripIds)) {
    const { data, error } = await supabase()
      .from("trip_documents")
      .select("trip_id, document_number")
      .eq("document_type", "lr")
      .in("trip_id", chunk);
    if (error || !data?.length) continue;
    for (const row of data) {
      const tripId = String((row as { trip_id?: string }).trip_id ?? "").trim();
      if (!tripId || tripId === excludeTripId) continue;
      const stored = lrNumberFromStoredDocumentNumber(
        (row as { document_number?: string | null }).document_number,
      );
      if (stored && stored === wanted) return { tripId };
    }
  }
  return null;
}

export async function findOrgDuplicateLrNumberForTrip(input: {
  tripId: string;
  lrNumber: string;
}): Promise<{ tripId: string } | null> {
  const tripId = input.tripId.trim();
  if (!tripId) return null;
  const { data, error } = await supabase()
    .from("trips")
    .select("organization_id")
    .eq("id", tripId)
    .maybeSingle();
  if (error) return null;
  const organizationId = String(
    (data as { organization_id?: string | null } | null)?.organization_id ?? "",
  ).trim();
  if (!organizationId) return null;
  return findOrgDuplicateLrNumber({
    organizationId,
    lrNumber: input.lrNumber,
    excludeTripId: tripId,
  });
}
