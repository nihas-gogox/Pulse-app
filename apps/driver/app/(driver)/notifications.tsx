import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverNotificationsScreen = lazy(() => import('../../features/drivers/screens/DriverNotificationsScreen'));

export default function NotificationsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverNotificationsScreen />
    </Suspense>
  );
}
