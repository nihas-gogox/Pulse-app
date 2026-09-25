import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const SalaryRequestScreen = lazy(() => import('../../../features/drivers/screens/DriverSalaryRequestScreen'));

export default function SalaryRequestRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <SalaryRequestScreen />
    </Suspense>
  );
}
