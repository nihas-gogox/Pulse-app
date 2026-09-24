import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverRequestsScreen = lazy(() => import('../../features/drivers/screens/DriverRequestsScreen'));

export default function RequestsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverRequestsScreen />
    </Suspense>
  );
}
