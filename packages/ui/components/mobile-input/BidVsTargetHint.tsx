import Theme from "@pulse/core/constants/Theme";
import { memo } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import type { BidVsTargetTone } from "./bidVsTarget";

export type BidVsTargetHintProps = {
  caption: string;
  tone: BidVsTargetTone;
  style?: StyleProp<TextStyle>;
};

export const BidVsTargetHint = memo(function BidVsTargetHint({
  caption,
  tone,
  style,
}: BidVsTargetHintProps) {
  return (
    <Text
      style={[
        styles.caption,
        tone === "over" && styles.over,
        tone === "under" && styles.under,
        tone === "match" && styles.match,
        style,
      ]}
      numberOfLines={1}
      accessibilityLiveRegion="polite"
    >
      {caption}
    </Text>
  );
});

const styles = StyleSheet.create({
  caption: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.15,
    textAlign: "center",
    lineHeight: 14,
  },
  over: {
    color: Theme.negative,
  },
  under: {
    color: Theme.positive,
  },
  match: {
    color: Theme.textMuted,
  },
});
