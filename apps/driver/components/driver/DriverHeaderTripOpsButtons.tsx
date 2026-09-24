import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, View } from "react-native";

import Theme from "@pulse/core/constants/Theme";

const OPS_BTN_SIZE = 34;
const OPS_ICON_SIZE = 15;

type Props = {
  hasActiveTrip: boolean;
  showExpense?: boolean;
  showOdometer?: boolean;
  onPressExpense: () => void;
  onPressOdometer: () => void;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
};

export function DriverHeaderTripOpsButtons({
  hasActiveTrip,
  showExpense = true,
  showOdometer = true,
  onPressExpense,
  onPressOdometer,
  surfaceColor,
  borderColor,
  textColor,
  accentColor,
}: Props) {
  const inactive = !hasActiveTrip;

  return (
    <View style={styles.cluster}>
      {showExpense ? (
        <Pressable
          onPress={onPressExpense}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: surfaceColor,
              borderColor,
              opacity: pressed ? 0.82 : inactive ? 0.72 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            hasActiveTrip ? "Add expense for active trip" : "Add expense — no active trip"
          }
          accessibilityHint={
            hasActiveTrip
              ? "Opens expense entry for your current trip"
              : "Requires an active trip"
          }
        >
          <Feather name="plus-circle" size={OPS_ICON_SIZE} color={inactive ? textColor : accentColor} />
        </Pressable>
      ) : null}
      {showOdometer ? (
        <Pressable
          onPress={onPressOdometer}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: surfaceColor,
              borderColor,
              opacity: pressed ? 0.82 : inactive ? 0.72 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            hasActiveTrip ? "Odometer reading for active trip" : "Odometer — no active trip"
          }
          accessibilityHint={
            hasActiveTrip
              ? "Scan dashboard photo to record KM"
              : "Requires an active trip"
          }
        >
          <Feather
            name="activity"
            size={OPS_ICON_SIZE}
            color={inactive ? textColor : Theme.pulseIndigo}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  btn: {
    width: OPS_BTN_SIZE,
    height: OPS_BTN_SIZE,
    borderRadius: OPS_BTN_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: OPS_BTN_SIZE,
  },
});

export const DRIVER_HEADER_OPS_BTN_SIZE = OPS_BTN_SIZE;
