/**
 * Safe back navigation: pop the screen the user actually came from.
 * When there is no in-app history (modal opened as the first screen),
 * replaces with a fallback route to avoid "GO_BACK was not handled" errors.
 */
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";

import { hasInAppPrevious, peekInAppPrevious } from "@/lib/inAppHistory";

const DEFAULT_FALLBACK = "/(tabs)/finance";

type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: never) => void;
};

function canUseBrowserHistoryBack(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  if (!hasInAppPrevious()) return false;
  return window.history.length > 1;
}

export function performSafeBack(
  router: BackRouter,
  fallbackRoute: string = DEFAULT_FALLBACK,
): void {
  // Browser history matches the page the user opened this screen from.
  // `router.canGoBack()` is often false on web, and `replace(home)` remounts
  // the trips board as if the app just started.
  if (canUseBrowserHistoryBack()) {
    window.history.back();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  const previous = peekInAppPrevious();
  router.replace((previous ?? fallbackRoute) as never);
}

export function useSafeBack(fallbackRoute: string = DEFAULT_FALLBACK): () => void {
  const router = useRouter();
  return useCallback(() => {
    performSafeBack(router, fallbackRoute);
  }, [router, fallbackRoute]);
}
