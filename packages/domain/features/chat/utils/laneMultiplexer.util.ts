import type { TripConversation, TripMessageRow } from "../types/chat.types";

/** Mirrors `public.fn_build_chat_lanes` — commercial vs operational routing. */
export interface ContextMessageGroup {
  contextKind: "indent" | "trip";
  contextId: string;
  messageIds: string[];
}

export interface ChatLanes {
  commercialByIndent: Record<string, string[]>;
  operationalByTrip: Record<string, string[]>;
  /** From `get_unified_b2b_bootstrap.messages_by_context` — message ids grouped by routing context. */
  messagesByContext?: ContextMessageGroup[];
}

const LEDGER_TYPES = new Set(["ledger_event", "ledger", "payment", "ledger_update"]);

function appendUnique(map: Record<string, string[]>, key: string, msgId: string): void {
  if (!key || !msgId) return;
  const cur = map[key] ?? [];
  if (cur.includes(msgId)) return;
  map[key] = [...cur, msgId];
}

/**
 * Client-side lane multiplexer (same rules as SQL `fn_build_chat_lanes`).
 * Use when bootstrap RPC returns conversations only, or to validate server `lanes`.
 */
export function buildChatLanesFromConversations(conversations: TripConversation[]): ChatLanes {
  const commercialByIndent: Record<string, string[]> = {};
  const operationalByTrip: Record<string, string[]> = {};

  for (const conv of conversations) {
    const tripId = String(conv.trip_id ?? "").trim();
    const indentRaw = (conv as { indent_id?: string | null }).indent_id;
    const indentKey =
      indentRaw != null && String(indentRaw).trim() !== "" ? String(indentRaw).trim() : "";

    const msgs: TripMessageRow[] = Array.isArray(conv.messages) ? conv.messages : [];
    for (const m of msgs) {
      const id = String(m.id ?? "").trim();
      if (!id || !tripId) continue;
      const mt = String(m.message_type ?? "");
      if (LEDGER_TYPES.has(mt)) {
        if (indentKey) appendUnique(commercialByIndent, indentKey, id);
        continue;
      }
      appendUnique(operationalByTrip, tripId, id);
    }
  }

  return { commercialByIndent, operationalByTrip };
}

/** Merge server lanes object `{ commercial_by_indent, operational_by_trip }` into camelCase ChatLanes. */
export function normalizeServerLanes(raw: Record<string, unknown> | null | undefined): ChatLanes | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw.commercial_by_indent ?? raw.commercialByIndent;
  const o = raw.operational_by_trip ?? raw.operationalByTrip;
  if (typeof c !== "object" || c === null || typeof o !== "object" || o === null) return null;

  const toStrListMap = (node: unknown): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    if (!node || typeof node !== "object" || Array.isArray(node)) return out;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      out[k] = v
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        .map((s) => s.replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    return out;
  };

  return {
    commercialByIndent: toStrListMap(c),
    operationalByTrip: toStrListMap(o),
  };
}

function parseMessagesByContextRaw(raw: unknown): ContextMessageGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: ContextMessageGroup[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const kind = String(r.context_kind ?? r.contextKind ?? "")
      .toLowerCase()
      .trim();
    const cid = String(r.context_id ?? r.contextId ?? "").trim();
    const idsRaw = r.message_ids ?? r.messageIds;
    const ids = Array.isArray(idsRaw)
      ? idsRaw
          .map((x) => {
            if (typeof x === "string") return x.replace(/^"|"$/g, "");
            if (x != null && typeof x === "object" && "id" in (x as object)) return String((x as { id: unknown }).id);
            return String(x).replace(/^"|"$/g, "");
          })
          .filter(Boolean)
      : [];
    if (!cid || (kind !== "indent" && kind !== "trip")) continue;
    out.push({ contextKind: kind as "indent" | "trip", contextId: cid, messageIds: ids });
  }
  return out;
}

/** Attach `messages_by_context` from multi-lane / unified bootstrap onto lanes. */
export function mergeMessagesByContextIntoLanes(
  lanes: ChatLanes,
  messagesByContextRaw: unknown,
): ChatLanes {
  const messagesByContext = parseMessagesByContextRaw(messagesByContextRaw);
  if (messagesByContext.length === 0) return lanes;
  return { ...lanes, messagesByContext };
}

function mergeStrListMap(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...a };
  for (const [k, arr] of Object.entries(b)) {
    out[k] = Array.from(new Set([...(out[k] ?? []), ...arr]));
  }
  return out;
}

function mergeContextGroups(
  prev: ContextMessageGroup[] | undefined,
  next: ContextMessageGroup[] | undefined,
): ContextMessageGroup[] | undefined {
  if (!next?.length) return prev;
  if (!prev?.length) return next;
  const key = (g: ContextMessageGroup) => `${g.contextKind}:${g.contextId}`;
  const byKey = new Map<string, ContextMessageGroup>();
  for (const g of prev) {
    byKey.set(key(g), { ...g, messageIds: [...g.messageIds] });
  }
  for (const g of next) {
    const k = key(g);
    const ex = byKey.get(k);
    if (!ex) {
      byKey.set(k, { ...g, messageIds: [...g.messageIds] });
    } else {
      byKey.set(k, {
        ...ex,
        messageIds: Array.from(new Set([...ex.messageIds, ...g.messageIds])),
      });
    }
  }
  return [...byKey.values()];
}

/** Deep-merge lane maps when appending a bootstrap page (dedupe message ids per key). */
export function mergeChatLanes(
  prev: ChatLanes | null | undefined,
  next: ChatLanes,
): ChatLanes {
  const base = prev ?? { commercialByIndent: {}, operationalByTrip: {} };
  return {
    commercialByIndent: mergeStrListMap(base.commercialByIndent, next.commercialByIndent),
    operationalByTrip: mergeStrListMap(base.operationalByTrip, next.operationalByTrip),
    messagesByContext: mergeContextGroups(base.messagesByContext, next.messagesByContext),
  };
}
