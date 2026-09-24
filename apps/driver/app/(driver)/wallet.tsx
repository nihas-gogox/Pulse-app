import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverWalletScreen = lazy(() => import('../../features/drivers/screens/DriverWalletScreen'));

export default function WalletRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverWalletScreen />
    </Suspense>
  );
}
