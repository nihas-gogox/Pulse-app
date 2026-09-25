import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const AvailableLoadDetailScreen = lazy(
  () => import('../../../features/driver/components/AvailableLoadDetailScreen'),
);

export default function AvailableLoadDetailRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <AvailableLoadDetailScreen />
    </Suspense>
  );
}
