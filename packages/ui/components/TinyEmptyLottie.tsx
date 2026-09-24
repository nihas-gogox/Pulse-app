import LottieView from "lottie-react-native";
import { StyleSheet, View } from "react-native";
import type { LottieSource } from "@/lib/lottieSource";

/** Empty-state Lottie JSONs have large transparent margins — overscale the render. */
const EMPTY_LOTTIE_RENDER_SCALE = 1.7;

type TinyEmptyLottieProps = {
  source: LottieSource;
  size?: number;
  speed?: number;
  renderScale?: number;
  loop?: boolean;
};

export function TinyEmptyLottie({
  source,
  size = 56,
  speed = 0.85,
  renderScale = EMPTY_LOTTIE_RENDER_SCALE,
  loop = true,
}: TinyEmptyLottieProps) {
  const renderSize = Math.round(size * renderScale);
  const offset = (size - renderSize) / 2;
  return (
    <View style={[styles.slot, { width: size, height: size }]}>
      <LottieView
        source={source}
        autoPlay
        loop={loop}
        speed={speed}
        resizeMode="contain"
        style={{
          width: renderSize,
          height: renderSize,
          position: "absolute",
          left: offset,
          top: offset,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
});
