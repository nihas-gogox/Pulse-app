import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const OwnerVehicleDetailScreen = lazy(
  () => import('../../../features/driver/components/OwnerVehicleDetailScreen'),
);

export default function MyFleetVehicleRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <OwnerVehicleDetailScreen />
    </Suspense>
  );
}
