import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const PendingEarningsScreen = lazy(() => import('../../features/drivers/screens/DriverPendingEarningsScreen'));

export default function PendingEarningsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <PendingEarningsScreen />
    </Suspense>
  );
}
