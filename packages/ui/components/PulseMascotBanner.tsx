/**
 * Renders a `PULSE_MASCOT_ILLUSTRATIONS` entry inside a promo banner or board.
 *
 * The source SVGs declare `preserveAspectRatio="none"`, so this measures the
 * available width and derives the height from the asset's own aspect rather
 * than letting the parent stretch the drawing.
 */
import {
  PULSE_MASCOT_ILLUSTRATIONS,
  type PulseMascotIllustrationId,
} from "@pulse/core/lib/pulseMascotIllustrations";
import { useState } from "react";
import { View, type LayoutChangeEvent, type ViewStyle } from "react-native";

export type PulseMascotBannerProps = {
  id: PulseMascotIllustrationId;
  /** Caps the drawn height; width follows from the asset aspect. */
  maxHeight: number;
  style?: ViewStyle;
};

export function PulseMascotBanner({
  id,
  maxHeight,
  style,
}: PulseMascotBannerProps) {
  const [slotWidth, setSlotWidth] = useState(0);
  const { Art, aspect } = PULSE_MASCOT_ILLUSTRATIONS[id];

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && next !== slotWidth) setSlotWidth(next);
  };

  const height = Math.min(maxHeight, slotWidth / aspect);
  const width = height * aspect;

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width: "100%",
          height: maxHeight,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {slotWidth > 0 ? (
        <Art
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
    </View>
  );
}
