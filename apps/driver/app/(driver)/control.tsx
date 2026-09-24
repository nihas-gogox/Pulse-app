import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverControlScreen = lazy(() => import('../../features/drivers/screens/DriverControlScreen'));

export default function ControlRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverControlScreen />
    </Suspense>
  );
}
