import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const CapacityStoryComposerScreen = lazy(
  () => import('../../features/driver/components/CapacityStoryComposerScreen'),
);

export default function CapacityStoryRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <CapacityStoryComposerScreen />
    </Suspense>
  );
}
