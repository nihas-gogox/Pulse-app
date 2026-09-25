import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverDocumentsScreen = lazy(() => import('../../features/drivers/screens/DriverDocumentsScreen'));

export default function DocumentsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverDocumentsScreen />
    </Suspense>
  );
}
