/**
 * Inline loading spinner used across screens (buttons, lists, modals).
 * For full-screen loading with safe area, use `AppLoadingSplash` or `CenteredLoadingView`.
 */
import Theme from "@pulse/core/constants/Theme";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type LoadingIndicatorSize = "small" | "large" | number;

export interface LoadingIndicatorProps {
  size?: LoadingIndicatorSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function resolveActivitySize(
  size: LoadingIndicatorSize,
): "small" | "large" | number {
  if (typeof size === "number") {
    return Platform.OS === "web" ? size : size <= 22 ? "small" : "large";
  }
  return size;
}

export function LoadingIndicator({
  size = "small",
  color = Theme.primary,
  style,
}: LoadingIndicatorProps) {
  const activitySize = resolveActivitySize(size);
  const scale =
    typeof size === "number" && Platform.OS !== "web"
      ? size / (activitySize === "small" ? 20 : 36)
      : 1;

  return (
    <View
      style={[
        styles.wrap,
        style,
        scale !== 1 ? { transform: [{ scale }] } : null,
      ]}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size={activitySize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
