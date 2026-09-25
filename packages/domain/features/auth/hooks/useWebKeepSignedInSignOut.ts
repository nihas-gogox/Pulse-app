/**
 * Web-only: cross-tab session sync via storage events.
 *
 * We intentionally do NOT sign out on document.visibilitychange — unlike native
 * AppState "background", a hidden browser tab is normal (devtools, alt-tab, HMR)
 * and caused spurious sign-outs on /sign-in and other auth screens.
 */
import { logAuth } from "@pulse/core/lib/authEngine";
import { useEffect } from "react";
import { Platform } from "react-native";

/** Supabase JS v2 persists session under sb-<project-ref>-auth-token */
function isSupabaseAuthStorageKey(key: string | null): boolean {
  if (!key) return false;
  return key === "supabase.auth.token" || /^sb-.*-auth-token$/.test(key);
}

export function useWebKeepSignedInSignOut(
  clearAuthState: (expired: boolean) => void,
  _signOutRequestedRef: React.MutableRefObject<boolean>,
) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (!isSupabaseAuthStorageKey(e.key)) return;
      if (e.newValue === null) {
        clearAuthState(false);
        logAuth("web_cross_tab_sign_out");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearAuthState]);
}
