import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DcoStatusScreen = lazy(
  () => import('../../features/driver/components/DcoStatusScreen'),
);

export default function DcoStatusRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DcoStatusScreen />
    </Suspense>
  );
}
