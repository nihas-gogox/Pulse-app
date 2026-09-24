import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverPassbookScreen = lazy(() => import('../../../features/drivers/screens/DriverPassbookDetailScreen'));

export default function PassbookRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverPassbookScreen />
    </Suspense>
  );
}
