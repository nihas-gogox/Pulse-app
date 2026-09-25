/**
 * General Expo Go environment check.
 *
 * The map-stack selection that used to live here now goes through
 * `lib/maps/mapEnvironment.ts` (single source of truth) and the registry in
 * `lib/maps/mapImplementationRegistry.ts`. This module remains for non-map
 * consumers such as the splash-screen guard.
 */
export { isExpoGoMapEnvironment as isExpoGo } from "./maps/mapEnvironment";
