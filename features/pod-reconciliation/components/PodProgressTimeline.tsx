import Theme from "@/constants/Theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { StyleSheet, Text, View } from "react-native";
import type { PodTimelineStep } from "../utils/podWorkflowDisplay.util";

export function PodProgressTimeline({ steps }: { steps: PodTimelineStep[] }) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const done = step.state === "done";
        const current = step.state === "current";
        const tone = done
          ? Theme.positive
          : current
            ? Theme.warning
            : Theme.borderMedium;
        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done || current ? tone : Theme.cardWhite,
                    borderColor: tone,
                  },
                ]}
              >
                {done ? (
                  <FontAwesome name="check" size={8} color={Theme.cardWhite} />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor: done
                        ? Theme.positive
                        : Theme.borderLight,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.labelWrap}>
              <Text
                style={[
                  styles.label,
                  done && styles.labelDone,
                  current && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
              {current ? (
                <Text style={styles.currentHint}>Current step</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    minHeight: 44,
  },
  rail: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
    borderRadius: 1,
  },
  labelWrap: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
    paddingBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  labelDone: {
    color: Theme.textPrimaryDark,
    fontWeight: "700",
  },
  labelCurrent: {
    color: Theme.warning,
    fontWeight: "800",
  },
  currentHint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
  },
});
