import DriverDetailScreen from '@/features/drivers/components/DriverDetailScreen';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/lib/useSafeBack';

type DriverDetailTab =
  | 'trips'
  | 'ledger'
  | 'statement'
  | 'ranking'
  | 'earnings';

function parseDriverDetailTab(raw: string | undefined): DriverDetailTab | undefined {
  if (
    raw === 'trips' ||
    raw === 'ledger' ||
    raw === 'statement' ||
    raw === 'ranking' ||
    raw === 'earnings' ||
    raw === 'cash'
  ) {
    return raw === 'cash' ? 'ledger' : raw;
  }
  return undefined;
}

export default function DriverDetailRoute() {
  const { id, profile, tab } = useLocalSearchParams<{
    id: string;
    profile?: string;
    tab?: string;
  }>();
  const safeBack = useSafeBack();
  const driverId = typeof id === 'string' ? id : id?.[0] ?? '';
  const tabRaw = typeof tab === 'string' ? tab : tab?.[0];
  const autoOpenProfile = profile === '1';

  return (
    <DriverDetailScreen
      driverId={driverId}
      onBack={safeBack}
      autoOpenProfile={autoOpenProfile}
      initialDetailTab={parseDriverDetailTab(tabRaw)}
    />
  );
}
