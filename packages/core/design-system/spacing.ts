/**
 * Pulse spacing scale — the only allowed spacing values.
 * Do not use arbitrary padding/margin (10, 13, 15, 22, etc.).
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
} as const;

export type SpaceToken = keyof typeof space;

/** Screen horizontal gutters (dispatch mobile default). */
export const screenPaddingX = space[4];

/** Vertical gap between major sections. */
export const sectionGap = space[6];

/** Gap inside grouped fields / list clusters. */
export const groupGap = space[3];

/** Inline icon-to-label gap. */
export const inlineGap = space[2];

/** Minimum touch target (Apple HIG). */
export const touchTargetMin = 44;

/** FAB / bottom primary action offset above safe area (add insets in component). */
export const bottomActionOffset = space[6];

export default space;
