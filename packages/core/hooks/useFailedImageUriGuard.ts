/**
 * Cross-mount guard against re-loading an image URI that keeps failing.
 *
 * Each avatar component already stops after one `onError` — but that state dies
 * with the component. A list that re-mounts rows (virtualised scroll, a parent
 * re-render, a query refetch) hands the same broken URI to a fresh `<Image>`
 * every time, and each fresh mount retries it. On 2026-09-02 that produced
 * ~19,000 Storage GETs in 27 minutes against a single signed URL returning 400,
 * which contributed to exhausting the database connection pool.
 *
 * The failure count lives at module scope so it survives unmounts: a URI that
 * has failed MAX_ATTEMPTS times is treated as failed on sight, and callers fall
 * straight through to their initials/placeholder branch without touching the
 * network.
 */
import { useCallback, useState } from 'react';

/** Two strikes: enough to survive a transient blip, few enough to stop a flood. */
const MAX_ATTEMPTS = 2;

/**
 * Entries are evicted oldest-first past this size. A signed URL is single-use in
 * practice (the token changes on re-sign), so the map would otherwise grow for
 * the life of the session.
 */
const MAX_TRACKED_URIS = 500;

const failureCounts = new Map<string, number>();

function noteFailure(uri: string): void {
  const next = (failureCounts.get(uri) ?? 0) + 1;
  // Re-insert to move the key to the end of Map's insertion order, so eviction
  // below drops genuinely stale URIs rather than recently-active ones.
  failureCounts.delete(uri);
  failureCounts.set(uri, next);
  if (failureCounts.size > MAX_TRACKED_URIS) {
    const oldest = failureCounts.keys().next();
    if (!oldest.done) failureCounts.delete(oldest.value);
  }
}

function isExhausted(uri: string): boolean {
  return (failureCounts.get(uri) ?? 0) >= MAX_ATTEMPTS;
}

/** Test seam — no production caller should need this. */
export function __resetFailedImageUriGuard(): void {
  failureCounts.clear();
}

export interface FailedImageUriGuard {
  /** True when this URI should not be handed to an <Image> at all. */
  failed: boolean;
  /** Pass as the image's `onError`. Records the failure and hides the image. */
  onError: () => void;
}

/**
 * @param uri The URI about to be rendered, or null when there is nothing to show.
 */
export function useFailedImageUriGuard(uri: string | null | undefined): FailedImageUriGuard {
  // Local state exists so the *current* component re-renders on failure; the
  // module map is what makes the decision stick across mounts.
  const [localFailed, setLocalFailed] = useState(false);

  const onError = useCallback(() => {
    if (uri) noteFailure(uri);
    setLocalFailed(true);
  }, [uri]);

  const failed = !uri || localFailed || isExhausted(uri);

  return { failed, onError };
}
