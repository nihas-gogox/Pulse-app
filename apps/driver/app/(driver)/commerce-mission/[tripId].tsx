import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverCommerceMissionScreen = lazy(
  () => import('../../../features/driver/commerce-mission/DriverCommerceMissionScreen'),
);

export default function CommerceMissionRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverCommerceMissionScreen />
    </Suspense>
  );
}
