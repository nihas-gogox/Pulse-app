import type { CacheDomain } from '@pulse/domain/lib/cache/deltaTypes';

type CounterBucket = Record<string, number>;

const counters: CounterBucket = {};

function key(domain: CacheDomain, metric: string): string {
  return `${domain}:${metric}`;
}

export function bumpCacheMetric(domain: CacheDomain, metric: string, by: number = 1): void {
  const k = key(domain, metric);
  counters[k] = (counters[k] ?? 0) + by;
}

export function getCacheMetricsSnapshot(): Record<string, number> {
  return { ...counters };
}

export function logCacheMetricsIfDev(tag: string): void {
  if (!__DEV__) return;
  console.debug(`[cache-metrics:${tag}]`, getCacheMetricsSnapshot());
}
