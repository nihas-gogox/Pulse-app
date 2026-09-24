import LottieView, { type AnimationObject } from "lottie-react-native";
import { Platform, StyleSheet, View } from "react-native";

/** Small orbit-chip Lottie — fixed slot, clipped on web. */
export function HubPromoLottieIcon({
  source,
  size,
}: {
  source: AnimationObject;
  size: number;
}) {
  return (
    <View style={[styles.chipSlot, { width: size, height: size }]}>
      <LottieView
        source={source}
        autoPlay
        loop
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}

/** Hero Lottie — fixed slot with optional inner scale for visual normalization. */
export function HubPromoHeroLottie({
  source,
  width,
  height,
  renderScale = 1,
  resizeMode = "contain",
}: {
  source: AnimationObject;
  width: number;
  height: number;
  renderScale?: number;
  /** `cover` for wide canvases (e.g. driving scene) so the figure fills the square slot. */
  resizeMode?: "contain" | "cover" | "center";
}) {
  const renderW = Math.round(width * renderScale);
  const renderH = Math.round(height * renderScale);
  return (
    <View style={[styles.heroSlot, { width, height, maxWidth: width, maxHeight: height }]}>
      <LottieView
        source={source}
        autoPlay
        loop
        resizeMode={resizeMode}
        style={[
          {
            width: renderW,
            height: renderH,
            position: "absolute",
          },
          Platform.OS === "web"
            ? ({
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: resizeMode,
              } as object)
            : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipSlot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  heroSlot: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
