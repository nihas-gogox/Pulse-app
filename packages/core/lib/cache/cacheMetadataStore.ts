import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheMetaKey } from './cacheKeys';
import type {
  CacheDomain,
  DeltaCursor,
  DomainCacheMeta,
  SyncDecision,
  SyncPolicy,
} from '@pulse/domain/lib/cache/deltaTypes';

const DEFAULT_SCHEMA_VERSION = '1';

function nowIso(): string {
  return new Date().toISOString();
}

function parseDateMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export async function getDomainCacheMeta(
  domain: CacheDomain,
  orgId: string,
): Promise<DomainCacheMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheMetaKey(domain, orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DomainCacheMeta;
    if (!parsed || parsed.domain !== domain || parsed.orgId !== orgId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setDomainCacheMeta(meta: DomainCacheMeta): Promise<void> {
  await AsyncStorage.setItem(cacheMetaKey(meta.domain, meta.orgId), JSON.stringify(meta));
}

export async function upsertDomainCacheMeta(params: {
  domain: CacheDomain;
  orgId: string;
  schemaVersion?: string;
  cursor?: DeltaCursor | null;
  markFullSync?: boolean;
  etag?: string | null;
}): Promise<DomainCacheMeta> {
  const current = await getDomainCacheMeta(params.domain, params.orgId);
  // `cursor: null` must CLEAR the cursor, not fall through to the stored one —
  // callers pass null precisely to force the next sync down the full path (e.g.
  // after a truncated fetch whose max(updated_at) would skip rows). Coalescing
  // with `??` preserved the stale cursor and silently defeated that guard.
  const cursorProvided = 'cursor' in params;
  const next: DomainCacheMeta = {
    domain: params.domain,
    orgId: params.orgId,
    schemaVersion: params.schemaVersion ?? current?.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    lastSuccessfulCursor: cursorProvided
      ? (params.cursor ?? null)
      : (current?.lastSuccessfulCursor ?? null),
    lastDeltaSyncAt: nowIso(),
    lastFullSyncAt: params.markFullSync ? nowIso() : (current?.lastFullSyncAt ?? null),
    etag: params.etag ?? current?.etag ?? null,
  };
  await setDomainCacheMeta(next);
  return next;
}

export async function clearDomainCacheMeta(domain: CacheDomain, orgId: string): Promise<void> {
  await AsyncStorage.removeItem(cacheMetaKey(domain, orgId));
}

export async function clearAllDomainCacheMetaForOrg(orgId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const prefix = `pulse-cache-meta-v2:`;
  const targets = keys.filter((k) => k.startsWith(prefix) && k.endsWith(`:${orgId}`));
  if (targets.length === 0) return;
  await AsyncStorage.multiRemove(targets);
}

export function decideSyncMode(params: {
  meta: DomainCacheMeta | null;
  schemaVersion: string;
  policy: SyncPolicy;
  nowMs?: number;
}): SyncDecision {
  const { meta, schemaVersion, policy } = params;
  const nowMs = params.nowMs ?? Date.now();
  if (!meta) return { doFullSync: true, reason: 'missing-meta' };
  if (!meta.lastSuccessfulCursor) return { doFullSync: true, reason: 'missing-cursor' };
  if (meta.schemaVersion !== schemaVersion) {
    return { doFullSync: true, reason: 'schema-version-change' };
  }
  const lastDeltaSyncMs = parseDateMs(meta.lastDeltaSyncAt);
  if (!lastDeltaSyncMs || nowMs - lastDeltaSyncMs > policy.maxDeltaLagMs * 10) {
    return { doFullSync: true, reason: 'full-sync-expired' };
  }
  const lastFullSyncMs = parseDateMs(meta.lastFullSyncAt);
  if (!lastFullSyncMs || nowMs - lastFullSyncMs > policy.fullSyncEveryMs) {
    return { doFullSync: true, reason: 'full-sync-expired' };
  }
  return { doFullSync: false, reason: 'delta-ok' };
}
