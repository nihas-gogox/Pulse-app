/**
 * Border radius tokens — avoid one-off radii (10, 14, 34) in new code.
 */
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  /** Cards, sheets, large panels */
  '2xl': 24,
  full: 9999,
} as const;

export default radius;
