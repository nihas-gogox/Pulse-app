/**
 * My Fleet — list personal owner vehicles (Phase 1b).
 */
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import Theme from '@pulse/core/constants/Theme';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import {
  ownerVehicleSubtitle,
  ownerVehicleTitle,
} from '../services/ownerVehicles.service';
import { useDriverFleetOwnerQuery } from '../../../lib/queries/useDriverFleetOwnerQuery';
import { useDcoStatusQuery } from '../../../lib/queries/useDcoStatusQuery';
import { useOwnerVehiclesQuery } from '../../../lib/queries/useOwnerVehiclesQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin, Plus, Truck } from 'lucide-react-native';
import { useCallback } from 'react';
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

export default function MyFleetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const { isFleetOwner, isLoading: fleetOwnerLoading } = useDriverFleetOwnerQuery(
    profile?.uid,
  );
  const { isDcoApproved, isLoading: dcoLoading } = useDcoStatusQuery(profile?.uid);
  const ownerLoading = fleetOwnerLoading || dcoLoading;
  const canOwnVehicles = isFleetOwner || isDcoApproved;
  const { vehicles, isLoading, isRefetching, refetch, error } =
    useOwnerVehiclesQuery(profile?.uid);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(driver)/profile');
  }, [router]);

  const cardBorder = isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)';

  if (!ownerLoading && !canOwnVehicles) {
    return (
      <View style={[styles.root, { backgroundColor: pageBg }]}>
        <DriverSubScreenHeader
          title="My Fleet"
          subtitle="Fleet Owner or DCO required"
          onBack={handleBack}
        />
        <View style={styles.gatePad}>
          <Text style={[styles.gateTitle, { color: colors.text }]}>
            Become a Fleet Owner or DCO first
          </Text>
          <Text style={[styles.gateBody, { color: colors.textMuted }]}>
            Personal vehicles belong to your Fleet Owner or DCO profile — not a Business
            organization.
          </Text>
          <Pressable
            onPress={() =>
              router.push(
                ROUTES.driverBecomeFleetOwner() as Parameters<typeof router.push>[0],
              )
            }
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.emerald, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.ctaText}>Become a Fleet Owner</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(ROUTES.driverDcoStatus() as Parameters<typeof router.push>[0])
            }
            hitSlop={6}
          >
            <Text style={[styles.dcoLink, { color: colors.emerald }]}>
              Or request DCO status
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="My Fleet"
        subtitle={
          isLoading
            ? 'Loading…'
            : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`
        }
        onBack={handleBack}
        right={
          <Pressable
            onPress={() =>
              router.push(
                ROUTES.driverMyFleetAdd() as Parameters<typeof router.push>[0],
              )
            }
            hitSlop={8}
            style={[
              styles.addBtn,
              { backgroundColor: isDark ? colors.surfaceElevated : Theme.surfaceGray },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add vehicle"
          >
            <Plus size={18} color={colors.emerald} strokeWidth={2.4} />
          </Pressable>
        }
      />

      <Pressable
        onPress={() =>
          router.push(
            ROUTES.driverAvailableLoads() as Parameters<typeof router.push>[0],
          )
        }
        style={({ pressed }) => [
          styles.loadsPromo,
          {
            marginHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
            marginTop: 10,
            backgroundColor: colors.surface,
            borderColor: cardBorder,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.loadsPromoIcon,
            {
              backgroundColor: isDark
                ? colors.emeraldMuted
                : 'rgba(167,243,208,0.4)',
            },
          ]}
        >
          <MapPin size={16} color={colors.emerald} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.loadsPromoTitle, { color: colors.text }]}>
            Market
          </Text>
          <Text style={[styles.loadsPromoSub, { color: colors.textMuted }]}>
            Browse open marketplace demand · bid with your fleet
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingTop: 12,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.emerald}
          />
        }
      >
        {error ? (
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not load fleet.'}
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.emerald} style={{ marginTop: 28 }} />
        ) : vehicles.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: cardBorder },
            ]}
          >
            <Truck size={28} color={colors.emerald} strokeWidth={2.2} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Add your first vehicle
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Register trucks you own. This does not let you create trips — work
              still comes from clients or the market.
            </Text>
            <Pressable
              onPress={() =>
                router.push(
                  ROUTES.driverMyFleetAdd() as Parameters<typeof router.push>[0],
                )
              }
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.emerald, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.ctaText}>Add Vehicle</Text>
            </Pressable>
          </View>
        ) : (
          vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() =>
                router.push(
                  ROUTES.driverMyFleetVehicle(v.id) as Parameters<
                    typeof router.push
                  >[0],
                )
              }
              style={({ pressed }) => [
                styles.vehicleCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: cardBorder,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={styles.vehicleTop}>
                <View
                  style={[
                    styles.truckIcon,
                    {
                      backgroundColor: isDark
                        ? colors.emeraldMuted
                        : 'rgba(167,243,208,0.4)',
                    },
                  ]}
                >
                  <Truck size={18} color={colors.emerald} />
                </View>
                <View style={styles.vehicleText}>
                  <Text style={[styles.plate, { color: colors.text }]}>
                    {ownerVehicleTitle(v)}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                    {ownerVehicleSubtitle(v)}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        v.status === 'active'
                          ? colors.emerald
                          : v.status === 'maintenance'
                            ? Theme.warning
                            : colors.textMuted,
                    },
                  ]}
                />
                <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
                  {v.status === 'active'
                    ? 'Active'
                    : v.status === 'maintenance'
                      ? 'Maintenance'
                      : 'Inactive'}
                  {v.fuel_type ? ` · ${v.fuel_type}` : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadsPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  loadsPromoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadsPromoTitle: { fontSize: 14, fontWeight: '800' },
  loadsPromoSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  gatePad: { padding: 20, gap: 10 },
  gateTitle: { fontSize: 17, fontWeight: '800' },
  gateBody: { fontSize: 13, lineHeight: 19 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyBody: { fontSize: 13, lineHeight: 19 },
  vehicleCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  truckIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: { flex: 1, minWidth: 0, gap: 2 },
  plate: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  meta: { fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 52 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  cta: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    marginTop: 4,
  },
  ctaText: { fontSize: 14, fontWeight: '700', color: Theme.textOnPrimary },
  errorText: { color: Theme.negative, fontSize: 13, fontWeight: '600' },
  dcoLink: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});
