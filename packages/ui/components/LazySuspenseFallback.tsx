import Theme from "@pulse/core/constants/Theme";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/** Nested lazy boundary — parent screen chrome is already visible. */
export function LazySuspenseNullFallback() {
  return null;
}

/** Stack/detail routes: small in-content spinner, not a full chrome splash. */
export function LazySuspenseInlineFallback({
  message,
}: {
  message?: string;
}) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="small" color={Theme.primary} />
      {message ? <Text style={styles.label}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  label: {
    fontSize: 13,
    color: Theme.textSecondary,
  },
});
