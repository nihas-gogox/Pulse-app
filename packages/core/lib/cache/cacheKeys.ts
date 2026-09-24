import type { CacheDomain } from '@pulse/domain/lib/cache/deltaTypes';

const CACHE_PREFIX = 'pulse-cache-meta-v2';

export function cacheMetaKey(domain: CacheDomain, orgId: string): string {
  return `${CACHE_PREFIX}:${domain}:${orgId}`;
}

export function cacheSchemaVersionKey(domain: CacheDomain): string {
  return `${CACHE_PREFIX}:schema:${domain}`;
}
