import { Platform, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

/** Any RN style object — view, text, or image. Named styles in a StyleSheet mix all three. */
type AnyStyle = ViewStyle | TextStyle | ImageStyle;

/** Hex (#rgb / #rrggbb) or rgb/rgba string → rgba() for CSS box-shadow. */
function colorWithAlpha(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgba(")) return trimmed;
  if (trimmed.startsWith("rgb(")) {
    const inner = trimmed.slice(4, -1);
    return `rgba(${inner}, ${alpha})`;
  }
  const hex = trimmed.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** RN shadow props → `boxShadow` on web; unchanged on native. */
export function adaptShadowPropsForWeb(style: ViewStyle): ViewStyle {
  if (Platform.OS !== "web" || style == null || typeof style !== "object") {
    return style;
  }
  const raw = style as Record<string, unknown>;
  if (
    raw.shadowColor == null &&
    raw.shadowOffset == null &&
    raw.shadowOpacity == null &&
    raw.shadowRadius == null
  ) {
    return style;
  }
  const offset = (raw.shadowOffset as { width: number; height: number }) ?? {
    width: 0,
    height: 0,
  };
  const radius = (raw.shadowRadius as number) ?? 0;
  const opacity = (raw.shadowOpacity as number) ?? 0;
  const color = (raw.shadowColor as string) ?? "#000000";
  const {
    shadowColor: _c,
    shadowOffset: _o,
    shadowOpacity: _op,
    shadowRadius: _r,
    elevation: _e,
    ...rest
  } = raw;
  return {
    ...(rest as ViewStyle),
    boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${colorWithAlpha(color, opacity)}`,
  };
}

/**
 * Map shadow* styles to boxShadow for web before `StyleSheet.create`.
 *
 * The generic accepts sheets that mix view/text/image styles (a StyleSheet's
 * named entries commonly include Text styles), so styles pulled from a wrapped
 * sheet stay assignable to `<Text>`/`<Image>` — not just `<View>`.
 */
export function withWebSafeShadows<T extends Record<string, AnyStyle>>(
  styles: T,
): T {
  if (Platform.OS !== "web") return styles;
  const out = {} as T;
  for (const key of Object.keys(styles) as (keyof T)[]) {
    out[key] = adaptShadowPropsForWeb(styles[key] as ViewStyle) as T[keyof T];
  }
  return out;
}

/** Prefer `style.pointerEvents` over the deprecated `pointerEvents` prop (RN Web). */
export function pe(value: "auto" | "none" | "box-none" | "box-only"): ViewStyle {
  return { pointerEvents: value };
}
