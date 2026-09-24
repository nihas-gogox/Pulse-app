import { bumpCacheMetric } from './cacheMetrics';
import {
  decideSyncMode,
  getDomainCacheMeta,
  upsertDomainCacheMeta,
} from './cacheMetadataStore';
import type { CacheDomain, DeltaResponse, SyncPolicy } from '@/lib/cache/deltaTypes';
import { runSingleflight } from './singleflight';

/**
 * A full fetch, plus whether the server cut it off at a row cap.
 * Domains may return a bare array; it is treated as complete.
 */
export type FullFetchResult<T> = T[] | { rows: T[]; truncated?: boolean };

interface SyncDomainParams<T> {
  domain: CacheDomain;
  orgId: string;
  schemaVersion: string;
  policy: SyncPolicy;
  getFull: () => Promise<FullFetchResult<T>>;
  getDelta: (cursor: { updatedAt: string; tieBreakerId?: string | null }) => Promise<DeltaResponse<T>>;
  merge: (current: T[], delta: DeltaResponse<T>) => T[];
  currentRows: T[];
  /**
   * Lower bound on rows the cache must hold, when the domain can obtain one
   * cheaply. Must count only rows the delta path is guaranteed to keep — for
   * indents that means live (non-soft-deleted) rows, since the delta prunes
   * deleted ones via deletedIds while the full fetch still returns them. A
   * cache holding fewer rows than this is provably missing data, whatever the
   * two paths disagree about. Omit to skip the check.
   */
  getServerCount?: () => Promise<number | null>;
  /**
   * Row cap the full fetch applies. A cached list at the cap is legitimately
   * shorter than the server count, so the reconciliation check must ignore it
   * rather than resyncing on every single sync.
   */
  fullFetchCap?: number;
}

function normalizeFull<T>(result: FullFetchResult<T>): { rows: T[]; truncated: boolean } {
  if (Array.isArray(result)) return { rows: result, truncated: false };
  return { rows: result.rows, truncated: result.truncated === true };
}

export async function syncDomainRows<T>(params: SyncDomainParams<T>): Promise<T[]> {
  return runSingleflight(`sync:${params.domain}:${params.orgId}`, async () => {
    const meta = await getDomainCacheMeta(params.domain, params.orgId);
    const mode = decideSyncMode({
      meta,
      schemaVersion: params.schemaVersion,
      policy: params.policy,
    });

    if (mode.doFullSync || params.currentRows.length === 0) {
      return runFullSync(params);
    }

    try {
      const cursor = meta?.lastSuccessfulCursor;
      if (!cursor) return runFullSync(params);
      const delta = await params.getDelta(cursor);
      bumpCacheMetric(params.domain, 'delta_fetch');

      // The server can demand a full resync (e.g. a cursor it cannot honour).
      if (delta.fullSyncRequired) return runFullSync(params);

      const merged = params.merge(params.currentRows, delta);

      // Reconciliation: a delta merge only ever adds what the delta returned, so
      // any row missed earlier stays missing and the advancing cursor guarantees
      // it is never asked for again. Compare against the server count and resync
      // in full on a mismatch, rather than serving a list we know is short.
      if (await isCountMismatched(params, merged.length)) {
        bumpCacheMetric(params.domain, 'delta_fallback_full');
        return runFullSync(params);
      }

      await upsertDomainCacheMeta({
        domain: params.domain,
        orgId: params.orgId,
        schemaVersion: params.schemaVersion,
        cursor: delta.nextCursor ?? cursor,
      });
      return merged;
    } catch {
      bumpCacheMetric(params.domain, 'delta_fallback_full');
      return runFullSync(params);
    }
  });
}

async function runFullSync<T>(params: SyncDomainParams<T>): Promise<T[]> {
  const { rows, truncated } = normalizeFull(await params.getFull());
  bumpCacheMetric(params.domain, 'full_fetch');
  const maxUpdatedAt = extractMaxUpdatedAt(rows);

  // A truncated page must not seed the cursor: max(updated_at) of the newest N
  // rows is ahead of every row that got cut off, so subsequent deltas (which
  // query `updated_at > cursor`) would skip them forever. Store no cursor, which
  // forces the next sync through this same full path — correct, if less cheap.
  const cursor = truncated ? null : maxUpdatedAt ? { updatedAt: maxUpdatedAt } : null;

  await upsertDomainCacheMeta({
    domain: params.domain,
    orgId: params.orgId,
    schemaVersion: params.schemaVersion,
    cursor,
    markFullSync: true,
  });
  return rows;
}

/** True when a cheap server count is available and disagrees with the cached list. */
async function isCountMismatched<T>(
  params: SyncDomainParams<T>,
  cachedLength: number,
): Promise<boolean> {
  if (!params.getServerCount) return false;
  // At the cap the list is expected to be short — comparing would resync forever.
  if (params.fullFetchCap != null && cachedLength >= params.fullFetchCap) return false;
  try {
    const serverCount = await params.getServerCount();
    if (serverCount == null) return false;
    // Only a *short* cache indicates drift. A longer one can be a benign race
    // (a row deleted between the delta and the count), and resyncing on it would
    // fight with optimistic updates that intentionally run ahead of the server.
    // serverCount is a floor (live rows only). The cache may hold MORE than it
    // — the full fetch also returns soft-deleted rows — so only a cache below
    // the floor is provably missing data. This keeps the check exact-by-
    // construction instead of relying on a tuned slack value.
    return cachedLength < serverCount;
  } catch {
    // A failed count is not evidence of drift — keep the delta result.
    return false;
  }
}

function extractMaxUpdatedAt<T>(rows: T[]): string | null {
  let maxTs: string | null = null;
  for (const row of rows as Array<Record<string, unknown>>) {
    const value = typeof row.updated_at === 'string' ? row.updated_at : null;
    if (!value) continue;
    if (!maxTs || value > maxTs) maxTs = value;
  }
  return maxTs;
}
