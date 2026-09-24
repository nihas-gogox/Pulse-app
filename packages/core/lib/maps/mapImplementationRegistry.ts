/**
 * Dependency-injection seam for the two native map stacks.
 *
 * Why a registry instead of platform extensions: see `mapEnvironment.ts` —
 * Expo Go and standalone share one platform and one bundle, so the bundler
 * cannot pick for us. What the registry buys is that the ONE unavoidable
 * runtime branch lives here, in a single typed place, instead of being spread
 * across call sites as inline `require()`s with disabled lint rules.
 *
 * Contract: each implementation module is side-effect-loaded by exactly one
 * loader below, and only when its environment is the active one. Neither may be
 * imported statically anywhere — each throws at import time in the other
 * environment:
 *   - MapLibre in Expo Go       → MLRNCameraModule missing, throws on import
 *   - react-native-maps in prod → module is undefined (Sentry GX-PULSE-J)
 */
import { MAP_ENVIRONMENT, type MapEnvironment } from "./mapEnvironment";

/**
 * Loaders are lazy thunks so that referencing this module does not pull either
 * implementation into the module graph eagerly. Metro still bundles both files
 * (both packages are installed), but only the selected one is *evaluated*, and
 * evaluation is what crashes in the wrong environment.
 */
type ImplementationLoader<T> = () => T;

type ImplementationLoaders<T> = Record<MapEnvironment, ImplementationLoader<T>>;

/**
 * Resolve the implementation for the active environment, evaluating only that
 * one and memoizing the result.
 *
 * Returns `undefined` if the module loaded but did not expose the expected
 * export — callers render a fallback rather than taking the screen down, since
 * every current consumer treats the map as a non-critical preview.
 */
export function createMapImplementationResolver<T>(
  loaders: ImplementationLoaders<T>,
): () => T | undefined {
  let resolved: T | undefined;
  let hasResolved = false;

  return () => {
    if (hasResolved) return resolved;
    hasResolved = true;
    resolved = loaders[MAP_ENVIRONMENT]();
    return resolved;
  };
}
