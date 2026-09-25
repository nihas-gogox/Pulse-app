import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverStoriesScreen = lazy(() => import('../../features/reach/screens/DriverStoriesScreen'));

export default function DriverStoriesRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverStoriesScreen />
    </Suspense>
  );
}
