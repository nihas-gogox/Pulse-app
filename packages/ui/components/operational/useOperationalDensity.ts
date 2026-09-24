import { useMemo } from 'react';

import { density, type DensityTier } from '@/design-system';

export function useOperationalDensity(tier: DensityTier = 'medium') {
  return useMemo(() => density[tier], [tier]);
}

export type { DensityTier };
