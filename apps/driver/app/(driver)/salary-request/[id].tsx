import { LazySuspenseInlineFallback } from '@pulse/ui/components/LazySuspenseFallback';
import { lazy, Suspense } from 'react';

const DriverSalaryRequestDetailScreen = lazy(
  () => import('../../../features/drivers/screens/DriverSalaryRequestDetailScreen'),
);

export default function SalaryRequestDetailRoute() {
  return (
    <Suspense fallback={<LazySuspenseInlineFallback />}>
      <DriverSalaryRequestDetailScreen />
    </Suspense>
  );
}
