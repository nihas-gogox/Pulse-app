/**
 * Phase A/B — Market Awards: this DCO's own awarded trips (trips.source =
 * 'market_bid'), reusing trips_driver_view. Distinct from My Bids — the
 * trip is the execution object, not the bid.
 */
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import Theme from '@pulse/core/constants/Theme';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { useMyMarketAwardsQuery } from '../../../lib/queries/useMyMarketAwardsQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import type { DriverTripRow } from '@pulse/domain/types/trip-views';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight, Trophy } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

function formatAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return 'Rate hidden';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'cancelled':
      return 'Cancelled';
    case 'completed':
      return 'Completed';
    default:
      return 'Active';
  }
}

export default function MarketAwardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const cardBorder = isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)';

  const { awards, isLoading, isRefetching, refetch, error } = useMyMarketAwardsQuery(uid);

  const { active, closed } = useMemo(() => {
    const active: DriverTripRow[] = [];
    const closed: DriverTripRow[] = [];
    for (const t of awards) {
      (TERMINAL_STATUSES.has(t.status) ? closed : active).push(t);
    }
    return { active, closed };
  }, [awards]);

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="Awards"
        subtitle="Market"
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace(ROUTES.driverAvailableLoads() as Href)
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingTop: 12,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.emerald} />
        }
      >
        {error ? (
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not load your awards.'}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.emerald} style={{ marginTop: 28 }} />
        ) : awards.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: cardBorder }]}>
            <Trophy size={22} color={colors.emerald} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No awards yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Win a Market bid and the trip appears here.
            </Text>
          </View>
        ) : (
          <>
            {active.length > 0 ? (
              <Group title="Active" items={active} colors={colors} isDark={isDark} cardBorder={cardBorder} router={router} />
            ) : null}
            {closed.length > 0 ? (
              <Group title="Completed" items={closed} colors={colors} isDark={isDark} cardBorder={cardBorder} router={router} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Group({
  title,
  items,
  colors,
  isDark,
  cardBorder,
  router,
}: {
  title: string;
  items: DriverTripRow[];
  colors: ReturnType<typeof useDriverThemeColors>;
  isDark: boolean;
  cardBorder: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title.toUpperCase()} · {items.length}
      </Text>
      <View style={{ gap: 8 }}>
        {items.map((trip) => (
          <Pressable
            key={trip.id}
            onPress={() => router.push(`/driver-trip/${trip.id}` as Href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: cardBorder, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.route, { color: colors.text }]} numberOfLines={1}>
                {trip.pickup_location?.trim() || 'Pickup'} → {trip.dropoff_location?.trim() || 'Drop'}
              </Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </View>
            <Text style={[styles.amount, { color: Theme.warning }]}>
              {formatAmount(trip.client_price)}
            </Text>
            <View
              style={[styles.statusPill, { backgroundColor: isDark ? colors.surfaceElevated : Theme.surfaceGray }]}
            >
              <Text style={[styles.statusText, { color: colors.textMuted }]}>
                {statusLabel(trip.status)} · {formatWhen(trip.created_at)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  route: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  amount: { fontSize: 18, fontWeight: '800' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  empty: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyBody: { fontSize: 13, lineHeight: 19 },
  errorText: { color: Theme.negative, fontSize: 13, fontWeight: '600' },
});
