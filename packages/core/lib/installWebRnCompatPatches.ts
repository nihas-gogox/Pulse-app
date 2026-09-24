/**
 * Web-only RN compatibility shims. Import this as early as possible in `app/_layout.tsx`
 * (before feature modules that call `StyleSheet.create`) so shadow* → boxShadow conversion
 * runs at stylesheet creation time.
 */
import { Platform, StyleSheet, type ViewStyle } from "react-native";

import { installDevConsoleFilters } from "./devConsoleFilters";
import { adaptShadowPropsForWeb, withWebSafeShadows } from "./platformViewStyle.util";

const PATCHED = Symbol.for("q.web.stylesheet.patched");
const FLATTEN_PATCHED = Symbol.for("q.web.stylesheet.flatten.patched");

function installWebStyleSheetPatch(): void {
  if (Platform.OS !== "web") return;
  const create = StyleSheet.create as typeof StyleSheet.create & { [PATCHED]?: boolean };
  if (create[PATCHED]) return;
  const originalCreate = create.bind(StyleSheet);
  const patchedCreate = function patchedStyleSheetCreate<
    T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<Record<string, unknown>>,
  >(styles: T | StyleSheet.NamedStyles<T>): T {
    return originalCreate(
      withWebSafeShadows(styles as Record<string, ViewStyle>) as T,
    ) as T;
  };
  patchedCreate[PATCHED] = true;
  StyleSheet.create = patchedCreate as typeof StyleSheet.create;
}

/** Convert shadow* at apply-time for inline / dynamic styles that skip StyleSheet.create. */
function installWebStyleSheetFlattenPatch(): void {
  if (Platform.OS !== "web") return;
  const flatten = StyleSheet.flatten as typeof StyleSheet.flatten & { [FLATTEN_PATCHED]?: boolean };
  if (flatten[FLATTEN_PATCHED]) return;
  const originalFlatten = flatten.bind(StyleSheet);
  const patchedFlatten: typeof StyleSheet.flatten = (style) => {
    const flat = originalFlatten(style);
    if (flat == null) return flat;
    if (Array.isArray(flat)) {
      return flat.map((entry) => adaptShadowPropsForWeb(entry as ViewStyle)) as typeof flat;
    }
    return adaptShadowPropsForWeb(flat as ViewStyle) as typeof flat;
  };
  (patchedFlatten as typeof patchedFlatten & { [FLATTEN_PATCHED]?: boolean })[FLATTEN_PATCHED] = true;
  StyleSheet.flatten = patchedFlatten;
}

installWebStyleSheetPatch();
installWebStyleSheetFlattenPatch();
installDevConsoleFilters();

/** Re-apply patches after Fast Refresh may have restored original StyleSheet helpers. */
export function ensureWebRnCompatPatches(): void {
  installWebStyleSheetPatch();
  installWebStyleSheetFlattenPatch();
}
