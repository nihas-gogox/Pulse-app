/**
 * Which native map stack this binary can actually load.
 *
 * This is NOT a bundler-resolvable distinction. Expo Go and a standalone build
 * both report `Platform.OS === "android" | "ios"` and are served the SAME Metro
 * bundle — in dev, literally by the same Metro server. Metro platform extensions
 * (`.ios`, `.android`, `.web`) key off `platform`, so there is no `.expo` /
 * `.standalone` extension that could split these two apart at build time.
 *
 * The only thing that differs is which native modules got linked into the binary:
 *  - Expo Go     → ships `react-native-maps`; has NO MapLibre native module
 *  - standalone  → ships MapLibre via its config plugin; `react-native-maps` is
 *                  not linked (it has no Expo config plugin — see app.config.js)
 *
 * So the selection is inherently a runtime capability check. What we CAN remove
 * is the code smell: scattered inline `require()` calls with disabled lint rules
 * at each call site. See `mapImplementationRegistry` for how that is done.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";

export type MapEnvironment = "expo-go" | "standalone";

/**
 * Resolved once at module init — the execution environment cannot change during
 * the lifetime of the JS context, and a stable value keeps the registry's
 * exactly-one-load guarantee honest.
 */
export const MAP_ENVIRONMENT: MapEnvironment =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? "expo-go"
    : "standalone";

export const isExpoGoMapEnvironment = (): boolean =>
  MAP_ENVIRONMENT === "expo-go";
