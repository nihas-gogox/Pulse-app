import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const AvailableLoadsScreen = lazy(
  () => import('../../../features/driver/components/AvailableLoadsScreen'),
);

export default function AvailableLoadsIndexRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <AvailableLoadsScreen />
    </Suspense>
  );
}
