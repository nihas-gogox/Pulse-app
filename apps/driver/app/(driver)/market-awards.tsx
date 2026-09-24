import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const MarketAwardsScreen = lazy(() => import('../../features/driver/components/MarketAwardsScreen'));

export default function MarketAwardsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <MarketAwardsScreen />
    </Suspense>
  );
}
