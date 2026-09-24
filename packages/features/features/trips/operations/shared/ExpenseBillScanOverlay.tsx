import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = {
  visible: boolean;
  /** Max scan-line travel in px (default 30 for header thumb). */
  scanTravel?: number;
  label?: string;
};

function CornerBracket({
  style,
  opacity,
}: {
  style: object;
  opacity: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.bracket, style, animStyle]} />;
}

/** Scan-line overlay for bill / odometer photo while OCR is running. */
export function ExpenseBillScanOverlay({
  visible,
  scanTravel = 30,
  label = "AI scan",
}: Props) {
  const scanY = useSharedValue(0);
  const pulse = useSharedValue(0);
  const bracket = useSharedValue(0);
  const radar = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scanY.value = 0;
      pulse.value = 0;
      bracket.value = 0;
      radar.value = 0;
      return;
    }

    scanY.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    bracket.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.45, { duration: 600 }),
      ),
      -1,
      false,
    );
    radar.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [bracket, pulse, radar, scanY, visible]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value * scanTravel }],
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
  }));

  const lineTrailStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanY.value * scanTravel }],
    opacity: interpolate(pulse.value, [0, 1], [0.15, 0.35]),
    height: interpolate(scanY.value, [0, 0.5, 1], [8, 14, 8]),
  }));

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(radar.value, [0, 1], [0.4, 1.35]) }],
    opacity: interpolate(radar.value, [0, 0.7, 1], [0.55, 0.25, 0]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.75, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1]) }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.radarRing, radarStyle]} />

      <CornerBracket style={styles.bracketTL} opacity={bracket} />
      <CornerBracket style={styles.bracketTR} opacity={bracket} />
      <CornerBracket style={styles.bracketBL} opacity={bracket} />
      <CornerBracket style={styles.bracketBR} opacity={bracket} />

      <Animated.View style={[styles.scanTrail, lineTrailStyle]} />
      <Animated.View style={[styles.scanLine, lineStyle]} />

      <Animated.View style={[styles.labelWrap, labelStyle]}>
        <View style={styles.labelDot} />
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const BRACKET = 10;
const BRACKET_W = 2;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 20, 14, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    overflow: "hidden",
  },
  radarRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(110, 231, 183, 0.65)",
    backgroundColor: "rgba(110, 231, 183, 0.08)",
  },
  bracket: {
    position: "absolute",
    width: BRACKET,
    height: BRACKET,
    borderColor: "#6ee7b7",
  },
  bracketTL: {
    top: 4,
    left: 4,
    borderTopWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderTopLeftRadius: 3,
  },
  bracketTR: {
    top: 4,
    right: 4,
    borderTopWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderTopRightRadius: 3,
  },
  bracketBL: {
    bottom: 4,
    left: 4,
    borderBottomWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderBottomLeftRadius: 3,
  },
  bracketBR: {
    bottom: 4,
    right: 4,
    borderBottomWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderBottomRightRadius: 3,
  },
  scanTrail: {
    position: "absolute",
    top: 2,
    left: 4,
    right: 4,
    borderRadius: 2,
    backgroundColor: "rgba(110, 231, 183, 0.25)",
  },
  scanLine: {
    position: "absolute",
    top: 2,
    left: 3,
    right: 3,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#6ee7b7",
    shadowColor: "#6ee7b7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(110, 231, 183, 0.45)",
  },
  labelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#6ee7b7",
  },
  label: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.95)",
  },
});
