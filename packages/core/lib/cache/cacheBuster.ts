/**
 * Build-scoped cache identity.
 *
 * Both client caches (the persisted TanStack query cache and the delta-sync
 * cursor metadata) are stored per-device and survive reloads. Before this
 * existed, a cache that had drifted from the server — e.g. a delta cursor
 * advanced past rows the client never merged — stayed broken for its full
 * retention window on that one machine, while every other device looked fine.
 * Redeploying did not help, because nothing tied the stored cache to the build
 * that wrote it.
 *
 * Keying storage on the build id makes any deploy a clean slate: the persister
 * discards a mismatched cache outright, and the delta store falls back to a
 * full sync instead of trusting a cursor from older code.
 */
import Constants from 'expo-constants';

/** Netlify COMMIT_REF / EAS build id / 'dev', baked in at build time by app.config.js. */
export const BUILD_ID: string = (() => {
  const fromExtra = Constants.expoConfig?.extra?.buildId;
  if (typeof fromExtra === 'string' && fromExtra) return fromExtra;
  return 'dev';
})();

/**
 * Bump manually when a cache-layer change makes previously written entries
 * unsafe to read, independent of the deploy (e.g. a merge-semantics fix that
 * must invalidate caches even on an unchanged build id).
 */
const CACHE_CONTRACT_VERSION = '2';

/** Persister `buster`. A mismatch makes TanStack drop the whole persisted cache. */
export const QUERY_CACHE_BUSTER = `${CACHE_CONTRACT_VERSION}:${BUILD_ID}`;
