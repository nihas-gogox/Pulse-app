import { Platform } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Read `env(safe-area-inset-bottom)` — RN web often leaves `useSafeAreaInsets().bottom` at 0. */
export function readWebSafeAreaInsetBottom(): number {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return 0;
  }
  try {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;bottom:0;left:0;height:0;padding-bottom:constant(safe-area-inset-bottom);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
    document.body.appendChild(el);
    const px = parseFloat(getComputedStyle(el).paddingBottom);
    document.body.removeChild(el);
    if (Number.isFinite(px) && px > 0) return px;
  } catch {
    // ignore
  }

  // Android Chrome: env() is often 0 even with viewport-fit=cover; reserve gesture band.
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth < 1024
  ) {
    return 12;
  }
  return 0;
}

/** Bottom inset for fixed footers: native safe area + CSS env on mobile web. */
export function useEffectiveBottomInset(): number {
  const insets = useSafeAreaInsets();
  const [webBottom, setWebBottom] = useState(() =>
    Platform.OS === "web" ? readWebSafeAreaInsetBottom() : 0,
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const measure = () => setWebBottom(readWebSafeAreaInsetBottom());
    measure();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      vv?.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  if (Platform.OS !== "web") return insets.bottom;
  return Math.max(insets.bottom, webBottom);
}
