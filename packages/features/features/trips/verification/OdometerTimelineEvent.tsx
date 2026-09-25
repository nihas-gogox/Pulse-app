import Theme from "@pulse/core/constants/Theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { StyleSheet, Text, View } from "react-native";

export function OdometerTimelineEvent({
  label,
  timestamp,
}: {
  label: string;
  timestamp: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <FontAwesome name="dashboard" size={11} color={Theme.buttonPrimaryText} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.time}>{timestamp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.buttonPrimary,
  },
  body: {
    flex: 1,
  },
  label: {
    color: Theme.text,
    fontSize: 12,
    fontWeight: "700",
  },
  time: {
    color: Theme.textSecondary,
    fontSize: 11,
  },
});
