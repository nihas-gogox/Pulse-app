/**
 * Digits + caret for custom keypad fields.
 * Shrink-wraps so the caret sits after the last character on native and RN Web
 * (plain Text + flex:1 sibling parks the caret on the right edge on web).
 */
import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import Theme from "@pulse/core/constants/Theme";

export type KeypadDisplayValueWithCaretProps = {
  value: string;
  placeholder: string;
  showCaret: boolean;
  /** Empty fields sometimes put the caret before the placeholder. Default `end`. */
  caretPosition?: "start" | "end";
  valueStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
  caretStyle?: StyleProp<ViewStyle>;
  caret?: ReactNode;
  accessibilityLabel?: string;
  /** When false, cluster does not flex-fill (centered amount displays). Default true. */
  fillRow?: boolean;
};

export const KeypadDisplayValueWithCaret = memo(function KeypadDisplayValueWithCaret({
  value,
  placeholder,
  showCaret,
  caretPosition = "end",
  valueStyle,
  placeholderStyle,
  caretStyle,
  caret,
  accessibilityLabel,
  fillRow = true,
}: KeypadDisplayValueWithCaretProps) {
  const empty = !value;
  const caretNode = showCaret
    ? (caret ?? <View style={[styles.caret, caretStyle]} />)
    : null;
  return (
    <View style={[styles.cluster, fillRow && styles.clusterFill]}>
      <View style={styles.inline}>
        {caretPosition === "start" ? caretNode : null}
        <Text
          style={[valueStyle, empty && placeholderStyle]}
          numberOfLines={1}
          accessibilityLabel={accessibilityLabel ?? (value || placeholder)}
        >
          {value || placeholder}
        </Text>
        {caretPosition === "end" ? caretNode : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cluster: {
    minWidth: 0,
    justifyContent: "center",
  },
  clusterFill: {
    flex: 1,
  },
  /** Intrinsic width — never grows to fill the row (fixes RN Web caret). */
  inline: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexShrink: 1,
  },
  caret: {
    width: 2,
    height: 26,
    borderRadius: 1,
    marginLeft: 2,
    flexShrink: 0,
    backgroundColor: Theme.positive,
  },
});
