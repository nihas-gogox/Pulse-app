import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverTripsScreen = lazy(() => import('../../../features/drivers/screens/DriverTripHistoryScreen'));

export default function TripHistoryRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverTripsScreen />
    </Suspense>
  );
}
