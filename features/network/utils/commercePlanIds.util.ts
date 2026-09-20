/** Max execution plans to enrich for merged-order cards (clients + route). */
export const COMMERCE_PLAN_ENRICH_CAP = 80;

/** PostgREST `.in()` chunk — keeps URL/planner cost bounded. */
export const COMMERCE_PLAN_IN_CHUNK = 40;

const TERMINAL_INDENT_STATUS = new Set([
  "completed",
  "cancelled",
  "closed",
  "expired",
]);

export function extractCommercePlanIds(
  rows: ReadonlyArray<{ execution_plan_id?: string | null }>,
  limit: number = COMMERCE_PLAN_ENRICH_CAP,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : COMMERCE_PLAN_ENRICH_CAP;
  for (const row of rows) {
    const id =
      typeof row.execution_plan_id === "string"
        ? row.execution_plan_id.trim()
        : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= cap) break;
  }
  return ids;
}

/** Open/awarded loads first so card routes/clients aren't starved by history. */
export function prioritizeIndentRowsForPlanEnrichment<
  T extends { status?: string | null },
>(rows: readonly T[]): T[] {
  const active: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    const status = String(row.status ?? "").toLowerCase();
    if (TERMINAL_INDENT_STATUS.has(status)) rest.push(row);
    else active.push(row);
  }
  return [...active, ...rest];
}

export function chunkIds(ids: readonly string[], size: number = COMMERCE_PLAN_IN_CHUNK): string[][] {
  const chunkSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : COMMERCE_PLAN_IN_CHUNK;
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize));
  }
  return out;
}

export async function mapChunksInFlight<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}
