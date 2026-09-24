import { Platform, type ViewStyle } from 'react-native';

type NativeShadow = {
  color: string;
  opacity: number;
  radius: number;
  offsetY: number;
  elevation?: number;
};

/** Cross-platform shadow — `boxShadow` on web, `shadow*` + elevation on native. */
export function platformShadow(webBoxShadow: string, native: NativeShadow): ViewStyle {
  return Platform.select({
    web: { boxShadow: webBoxShadow },
    default: {
      shadowColor: native.color,
      shadowOpacity: native.opacity,
      shadowRadius: native.radius,
      shadowOffset: { width: 0, height: native.offsetY },
      elevation: native.elevation ?? 4,
    },
  }) as ViewStyle;
}
