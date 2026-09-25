/**
 * Safe back navigation: only calls router.back() when there is history.
 * When there is no screen to go back to (e.g. modal opened as first screen),
 * replaces with a fallback route to avoid "GO_BACK was not handled" errors.
 */
import { useRouter } from "expo-router";
import { useCallback } from "react";

const DEFAULT_FALLBACK = "/(tabs)/finance";

export function useSafeBack(fallbackRoute: string = DEFAULT_FALLBACK): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as Parameters<typeof router.replace>[0]);
    }
  }, [router, fallbackRoute]);
}
