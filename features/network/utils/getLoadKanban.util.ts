/**
 * Get Load (Find Work) Kanban — bucket market opportunities by buyer stage.
 * Open Market · My Bids · Bids Won · Claimed (tabs: In Transit / Completed).
 */
import type { IndentRow } from "@/features/indents";

export type GetLoadKanbanColumnId =
  | "OPEN"
  | "QUOTED"
  | "AWARDED"
  | "CLAIMED";

/** Sub-tabs inside the Claimed column only. */
export type GetLoadClaimedSubTabId = "IN_TRANSIT" | "COMPLETED";

export const GET_LOAD_KANBAN_COLUMNS: readonly GetLoadKanbanColumnId[] = [
  "OPEN",
  "QUOTED",
  "AWARDED",
  "CLAIMED",
];

export type GetLoadKanbanBuckets = {
  OPEN: IndentRow[];
  QUOTED: IndentRow[];
  AWARDED: IndentRow[];
  /** All claimed outcomes (union of in-transit + completed). */
  CLAIMED: IndentRow[];
  CLAIMED_IN_TRANSIT: IndentRow[];
  CLAIMED_COMPLETED: IndentRow[];
};

export function emptyGetLoadKanbanBuckets(): GetLoadKanbanBuckets {
  return {
    OPEN: [],
    QUOTED: [],
    AWARDED: [],
    CLAIMED: [],
    CLAIMED_IN_TRANSIT: [],
    CLAIMED_COMPLETED: [],
  };
}

export function getLoadKanbanColumnLabel(tabId: GetLoadKanbanColumnId): string {
  if (tabId === "OPEN") return "Network Loads";
  if (tabId === "QUOTED") return "My Bids";
  if (tabId === "AWARDED") return "Bids Won";
  return "Claimed";
}

export function bucketGetLoadIndentsForKanban(
  findWorkLoads: IndentRow[],
  awardedLoads: IndentRow[],
  doneLoads: IndentRow[],
  myQuoteByIndentId: ReadonlyMap<string, unknown> | ReadonlySet<string>,
  opts?: {
    searchQuery?: string;
    matchesSearch?: (load: IndentRow, query: string) => boolean;
    /** True when the indent’s linked trip is actively in transit. */
    isInTransit?: (indentId: string) => boolean;
  },
): GetLoadKanbanBuckets {
  const buckets = emptyGetLoadKanbanBuckets();
  const query = (opts?.searchQuery ?? "").trim();
  const matches = opts?.matchesSearch;
  const inTransit = opts?.isInTransit ?? (() => false);
  const hasQuote = (id: string) =>
    typeof (myQuoteByIndentId as Map<string, unknown>).has === "function"
      ? (myQuoteByIndentId as Map<string, unknown>).has(id)
      : (myQuoteByIndentId as Set<string>).has(id);

  const pass = (load: IndentRow) =>
    !query || !matches ? true : matches(load, query);

  for (const load of findWorkLoads) {
    if (!pass(load)) continue;
    if (hasQuote(load.id)) buckets.QUOTED.push(load);
    else buckets.OPEN.push(load);
  }

  for (const load of awardedLoads) {
    if (!pass(load)) continue;
    buckets.AWARDED.push(load);
  }

  for (const load of doneLoads) {
    if (!pass(load)) continue;
    buckets.CLAIMED.push(load);
    if (inTransit(load.id)) buckets.CLAIMED_IN_TRANSIT.push(load);
    else buckets.CLAIMED_COMPLETED.push(load);
  }

  return buckets;
}
