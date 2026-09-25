/**
 * Canonical color utility module — the deliberate home for color math in
 * this codebase, so it doesn't get reinvented ad hoc per-component the way
 * `${color}40` string concatenation was. Grow this file with functions like
 * `darken()`, `lighten()`, `mix()`, `isDark()`, `contrastColor()` if/when a
 * real call site needs them — don't add them speculatively ahead of use.
 *
 * Rule: all color transformations in the application go through this
 * module. Components must not manipulate color strings directly (string
 * concatenation, ad hoc regex, inline hex math) — that pattern is exactly
 * what produced the `${color}40` bug this module replaced, and it will
 * reappear elsewhere if color math stays scattered instead of centralized
 * here.
 */

/**
 * Canonical color-alpha transform. Handles hex (#RGB, #RRGGBB, #RRGGBBAA) and
 * rgb()/rgba() input, always returns an rgba() string — normalizing the
 * output means every caller gets a value every renderer (MapLibre paint
 * properties, React Native style props, CSS) accepts, regardless of what
 * shape the input theme color happened to be in.
 *
 * Exists because `${color}${hexAlphaSuffix}` (string-concatenating a 2-digit
 * hex alpha suffix onto a color) only works when `color` is hex — doing that
 * to an already-rgba() theme value (e.g. Theme.driverEmeraldBorderSoft =
 * "rgba(4,120,87,0.28)") produces an invalid color string
 * ("rgba(4,120,87,0.28)40") that MapLibre/react-native-maps silently reject.
 * Use this instead of ad hoc string concatenation anywhere a color needs its
 * opacity adjusted.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const trimmed = color.trim();

  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1]!.split(",").map((p) => p.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  const hex8 = trimmed.match(/^#([0-9a-f]{8})$/i);
  if (hex8) {
    const hex = hex8[1]!;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  const hex6 = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const hex = hex6[1]!;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  const hex3 = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const hex = hex3[1]!;
    const r = parseInt(hex[0]! + hex[0], 16);
    const g = parseInt(hex[1]! + hex[1], 16);
    const b = parseInt(hex[2]! + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  // Unknown shape (named CSS color, currentColor, etc.) — no safe way to
  // parse RGB channels out of it, so return unchanged rather than produce a
  // malformed string. That's the right call in production (never crash a
  // renderer over a color format this function doesn't parse yet) — but
  // silent forever means the next unsupported format reappears as a fresh
  // "color expected, ... found" renderer error with no lead back to here.
  if (__DEV__) {
    console.warn(`withAlpha(): unsupported color format "${color}" — returned unchanged.`);
  }
  return color;
}
