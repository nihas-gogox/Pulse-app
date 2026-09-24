import { TinyEmptyLottie } from "@pulse/ui/components/TinyEmptyLottie";
import { resolveChatPaymentLottieSource } from "@pulse/ui/lib/chatPaymentLottieAssets";
import { StyleSheet, View } from "react-native";

type ChatPaymentEventIconProps = {
  flow: "in" | "out";
  paymentMode: string;
  isAcknowledged: boolean;
  isDisputed: boolean;
  size?: number;
};

/** Minimal payment glyph — white node, hairline rim, tiny Lottie. */
export function ChatPaymentEventIcon({
  flow,
  paymentMode,
  isAcknowledged,
  isDisputed,
  size = 28,
}: ChatPaymentEventIconProps) {
  const dotColor = isDisputed
    ? "#D97706"
    : isAcknowledged
      ? "#059669"
      : flow === "in"
        ? "#10B981"
        : "#E11D48";

  const lottieSource = resolveChatPaymentLottieSource(
    flow,
    paymentMode,
    isAcknowledged,
    isDisputed,
  );
  const lottieSize = Math.round(size * 0.54);

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <TinyEmptyLottie
        source={lottieSource}
        size={lottieSize}
        speed={0.82}
        renderScale={1.38}
      />
      <View
        style={[
          styles.dot,
          {
            backgroundColor: dotColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4E6EF",
    overflow: "visible",
    flexShrink: 0,
  },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
