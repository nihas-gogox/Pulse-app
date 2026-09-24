import { space } from './spacing';
import { typography } from './typography';

/**
 * Density tiers — operational apps must not use one density everywhere.
 */
export const density = {
  low: {
    screenPaddingY: space[7],
    sectionGap: space[7],
    listRowPaddingY: space[4],
    listRowPaddingX: space[4],
    titleStyle: typography.heading,
    bodyStyle: typography.body,
    showBorders: false,
  },
  medium: {
    screenPaddingY: space[5],
    sectionGap: space[6],
    listRowPaddingY: space[3],
    listRowPaddingX: space[4],
    titleStyle: typography.title,
    bodyStyle: typography.body,
    showBorders: false,
  },
  high: {
    screenPaddingY: space[4],
    sectionGap: space[4],
    listRowPaddingY: space[2],
    listRowPaddingX: space[3],
    titleStyle: typography.label,
    bodyStyle: typography.caption,
    showBorders: true,
  },
} as const;

export type DensityTier = keyof typeof density;

export default density;
