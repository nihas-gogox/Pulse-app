import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const BecomeFleetOwnerScreen = lazy(
  () => import('../../features/driver/components/BecomeFleetOwnerScreen'),
);

export default function BecomeFleetOwnerRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <BecomeFleetOwnerScreen />
    </Suspense>
  );
}
