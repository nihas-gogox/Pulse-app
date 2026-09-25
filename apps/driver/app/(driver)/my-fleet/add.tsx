import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const AddOwnerVehicleScreen = lazy(
  () => import('../../../features/driver/components/AddOwnerVehicleScreen'),
);

export default function MyFleetAddRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <AddOwnerVehicleScreen />
    </Suspense>
  );
}
