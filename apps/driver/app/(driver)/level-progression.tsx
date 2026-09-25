import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const LevelProgressionScreen = lazy(() => import('../../features/drivers/screens/DriverLevelProgressionScreen'));

export default function LevelProgressionRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <LevelProgressionScreen />
    </Suspense>
  );
}
