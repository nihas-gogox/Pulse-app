import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";

/** Shared spring for mirror toggles (web nav + Slack chat). */
export const MIRROR_INDICATOR_SPRING = {
  useNativeDriver: true,
  speed: 22,
  bounciness: 4,
} as const;

/**
 * Layout-driven sliding indicator — thumb follows measured segment bounds.
 * Used by ChatSlackMirrorToggle and WebNavMirrorToggle.
 */
export function useMirrorIndicator(activeId: string, axis: "x" | "y" = "x") {
  const layouts = useRef<Record<string, { pos: number; size: number }>>({});
  const translate = useRef(new Animated.Value(0)).current;
  const [indicatorSize, setIndicatorSize] = useState(0);

  const snapTo = useCallback(
    (id: string) => {
      const layout = layouts.current[id];
      if (!layout) return;
      setIndicatorSize(layout.size);
      Animated.spring(translate, {
        toValue: layout.pos,
        ...MIRROR_INDICATOR_SPRING,
      }).start();
    },
    [translate],
  );

  useEffect(() => {
    snapTo(activeId);
  }, [activeId, snapTo]);

  const onItemLayout = useCallback(
    (id: string, e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      layouts.current[id] = {
        pos: axis === "x" ? x : y,
        size: axis === "x" ? width : height,
      };
      if (id === activeId) snapTo(id);
    },
    [activeId, axis, snapTo],
  );

  return { translate, indicatorSize, onItemLayout, axis };
}
