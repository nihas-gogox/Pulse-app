import type { TripMessageRow } from "../types/chat.types";

const BROADCAST_TYPES = new Set<string>(["system", "system_log", "update"]);

function tripStatusBroadcastDedupeKey(e: TripMessageRow): string | null {
  const meta = e.metadata as Record<string, unknown> | null | undefined;
  if (!meta || String(meta.trip_status_broadcast ?? "") !== "1") return null;
  if (!BROADCAST_TYPES.has(String(e.message_type))) return null;
  const body = String(e.content ?? "").trim();
  const fromMeta = typeof meta.status === "string" ? meta.status.trim() : "";
  const ep = meta.event_payload;
  const fromEp =
    ep &&
    typeof ep === "object" &&
    typeof (ep as { new_status?: unknown }).new_status === "string"
      ? String((ep as { new_status: string }).new_status).trim()
      : "";
  const st = fromMeta || fromEp;
  return `${st}\n${body}`;
}

/**
 * Same logical trip status line can appear multiple times in one lane (e.g.
 * visibility_tags fan-out + overlapping paths). Collapse to one row per
 * (status, body), preferring the message whose `conversation_id` matches this lane.
 */
export function dedupeTripStatusBroadcastsForLane(
  visible: TripMessageRow[],
  laneConversationId: string,
): TripMessageRow[] {
  const groups = new Map<string, TripMessageRow[]>();
  for (const e of visible) {
    const key = tripStatusBroadcastDedupeKey(e);
    if (key == null) continue;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const drop = new Set<string>();
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const preferred =
      sorted.find((x) => String(x.conversation_id ?? "") === laneConversationId) ??
      sorted[0];
    for (const x of arr) {
      if (x.id !== preferred.id) drop.add(x.id);
    }
  }
  if (drop.size === 0) return visible;
  return visible.filter((m) => !drop.has(m.id));
}
