import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverProfileScreen = lazy(() => import('../../features/drivers/screens/DriverProfileScreen'));

export default function ProfileRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverProfileScreen />
    </Suspense>
  );
}
