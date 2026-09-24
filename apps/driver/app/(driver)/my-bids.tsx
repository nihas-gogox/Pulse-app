import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const MyBidsScreen = lazy(() => import('../../features/driver/components/MyBidsScreen'));

export default function MyBidsRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <MyBidsScreen />
    </Suspense>
  );
}
