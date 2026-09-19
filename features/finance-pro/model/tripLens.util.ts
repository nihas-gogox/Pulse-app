/** Local copies of POD/completion predicates — no service/supabase import. */

export function financeProTripPodReceived(
  trip: {
    id?: string | null;
    pod_received_at?: string | null;
    pod_status?: unknown;
  },
  digitalPodTripIds?: ReadonlySet<string>,
): boolean {
  if (trip.pod_received_at) return true;
  if (String(trip.pod_status ?? "").toLowerCase() === "received") return true;
  const id = (trip.id ?? "").trim();
  if (id && digitalPodTripIds?.has(id)) return true;
  return false;
}

export function financeProTripCompleted(trip: {
  status?: string | null;
  completed_at?: string | null;
}): boolean {
  if (trip.completed_at) return true;
  const s = String(trip.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return s === "completed" || s === "delivered" || s === "done";
}
