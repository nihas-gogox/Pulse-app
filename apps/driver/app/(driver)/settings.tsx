import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverSettingsScreen = lazy(() => import('../../features/drivers/screens/DriverSettingsScreen'));

export default function SettingsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverSettingsScreen />
    </Suspense>
  );
}
