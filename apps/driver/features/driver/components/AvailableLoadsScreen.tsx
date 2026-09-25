/**
 * Phase 3A — Available Loads (read-only marketplace discovery for Fleet Owners).
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
  formatFleetOwnerRateOffer,
  isLoadCompatibleWithFleet,
  type FleetOwnerOpenLoad,
} from '../services/fleetOwnerLoads.service';
import { marketBidStatusLabel, type MarketBidStatus } from '../services/marketBids.service';
import { DriverWorkOpportunityCard } from './DriverWorkOpportunityCard';
import { MyBidsContent } from './MyBidsScreen';
import { cityOf, StoriesContent, type SharedFeedFilters } from '../../reach/screens/DriverStoriesScreen';
import { useDriverFleetOwnerQuery } from '../../../lib/queries/useDriverFleetOwnerQuery';
import { useFleetOwnerOpenLoadsQuery } from '../../../lib/queries/useFleetOwnerOpenLoadsQuery';
import { useMyMarketBidsQuery } from '../../../lib/queries/useMyMarketBidsQuery';
import { useOwnerVehiclesQuery } from '../../../lib/queries/useOwnerVehiclesQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function AvailableLoadsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  // A7.3: the DCO Available surface's "My Bids" entry deep-links here with
  // ?segment=mybids so it lands directly on this segment instead of Find Work.
  const { segment: initialSegment } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<'find' | 'mybids'>(
    initialSegment === 'mybids' ? 'mybids' : 'find',
  );
  const cardBorder = isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)';

  // Earnings-page pattern: Market chrome scrolls with the feed (not pinned).
  const marketListHeader = (
    <>
      <DriverSubScreenHeader
        title="Market"
        subtitle="Find work"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace(ROUTES.DRIVER_ROOT)
        }
      />
      <View
        style={[
          styles.segmentRow,
          {
            borderColor: cardBorder,
            backgroundColor: isDark ? colors.surfaceElevated : Theme.surfaceGray,
          },
        ]}
      >
        {(
          [
            { id: 'find' as const, label: 'Find Work' },
            { id: 'mybids' as const, label: 'My Bids' },
          ] as const
        ).map((seg) => {
          const on = segment === seg.id;
          return (
            <Pressable
              key={seg.id}
              onPress={() => setSegment(seg.id)}
              style={[
                styles.segmentBtn,
                on && {
                  backgroundColor: isDark ? colors.surface : Theme.cardWhite,
                  borderColor: cardBorder,
                },
              ]}
            >
              <Text style={[styles.segmentText, { color: on ? colors.text : colors.textMuted }]}>
                {seg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      {segment === 'mybids' ? (
        uid ? <MyBidsContent uid={uid} listHeader={marketListHeader} /> : null
      ) : uid ? (
        <MarketFindWorkScreen uid={uid} listHeader={marketListHeader} />
      ) : null}
    </View>
  );
}

/**
 * Market → Find Work: the existing Reach opportunities feed (`StoriesContent`,
 * unchanged) with formal open-Market loads composed in as its last section,
 * so both opportunity sources read as one feed instead of two stacked
 * screens. No new sorting/business logic — same components, same queries,
 * new composition only.
 */
function MarketFindWorkScreen({
  uid,
  listHeader,
}: {
  uid: string;
  listHeader?: ReactNode;
}) {
  const { loads, refetch: refetchLoads } = useFleetOwnerOpenLoadsQuery(uid);
  const { refetch: refetchBids } = useMyMarketBidsQuery(uid);

  // Shared pickup/drop filter chips should represent both sources (see
  // DriverStoriesScreen.tsx's extraPickupCities/extraDropCities) — derived
  // here, at the composition layer, from the same open-Market loads
  // FindLoadsContent already renders. No new query, no DB change.
  const extraPickupCities = useMemo(() => {
    const set = new Set<string>();
    for (const l of loads) {
      const c = cityOf(l.pickup_area);
      if (c) set.add(c);
    }
    return [...set];
  }, [loads]);
  const extraDropCities = useMemo(() => {
    const set = new Set<string>();
    for (const l of loads) {
      const c = cityOf(l.drop_location);
      if (c) set.add(c);
    }
    return [...set];
  }, [loads]);

  return (
    <StoriesContent
      listHeader={listHeader}
      footer={(filters) => <FindLoadsContent uid={uid} filters={filters} />}
      onRefreshExtra={() => {
        void refetchLoads();
        void refetchBids();
      }}
      extraPickupCities={extraPickupCities}
      extraDropCities={extraDropCities}
    />
  );
}

/**
 * Presentation-only content adapter — the same open-Market load list previously rendered inline
 * in this screen, now embeddable at the bottom of the unified Find Work feed as the Marketplace
 * (tender-board) layer. Shared pickup/drop/fits-my-fleet filters come from the parent feed rather
 * than owning a separate filter bar -- this reads as one filtered work surface, not two.
 */
function FindLoadsContent({ uid, filters }: { uid: string; filters: SharedFeedFilters }) {
  const router = useRouter();
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const { isFleetOwner, isLoading: ownerLoading } = useDriverFleetOwnerQuery(uid);
  const { loads, isLoading, error, refetch: refetchLoads } = useFleetOwnerOpenLoadsQuery(uid);
  const { vehicles } = useOwnerVehiclesQuery(uid);
  const { bids } = useMyMarketBidsQuery(uid);
  const cardBorder = isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)';

  // refetchOnWindowFocus is inert on React Native without an app-wide
  // TanStack Query focus manager registered (none exists in this app), so
  // returning to Find Work -- including right after completing a trip --
  // otherwise shows stale indents until a manual pull-to-refresh. Mirrors
  // the same useFocusEffect pattern DriverTripHistoryScreen.tsx already
  // uses for itself.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      void refetchLoads();
    }, [uid, refetchLoads]),
  );

  const fleetTypes = useMemo(
    () => vehicles.map((v) => v.vehicle_type),
    [vehicles],
  );

  const bidStatusByIndentId = useMemo(() => {
    const map = new Map<string, MarketBidStatus>();
    for (const b of bids) map.set(b.indent_id, b.status);
    return map;
  }, [bids]);

  const visible = useMemo(() => {
    return loads.filter((l) => {
      if (filters.pickup) {
        const origin = cityOf(l.pickup_area);
        if (origin.toLowerCase() !== filters.pickup.toLowerCase()) return false;
      }
      if (filters.drop) {
        const dest = cityOf(l.drop_location);
        if (dest.toLowerCase() !== filters.drop.toLowerCase()) return false;
      }
      if (filters.fitsFleet && !isLoadCompatibleWithFleet(l, fleetTypes)) return false;
      return true;
    });
  }, [loads, filters, fleetTypes]);

  if (!ownerLoading && !isFleetOwner) {
    return (
      <View style={styles.marketGate}>
        <Text style={[styles.marketplaceLabel, { color: colors.textMuted }]}>MARKETPLACE</Text>
        <Text style={[styles.gateBody, { color: colors.textMuted }]}>
          Open marketplace demand comes from businesses. Become a Fleet Owner
          to also bid in the Marketplace here.
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
      </View>
    );
  }

  return (
    <View style={styles.marketSection}>
      <View style={styles.marketplaceDivider} />
      <Text style={[styles.marketplaceLabel, { color: colors.textMuted }]}>MARKETPLACE</Text>

      <View style={styles.marketListPad}>
        {error ? (
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not load marketplace.'}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator color={colors.emerald} style={{ marginTop: 28 }} />
        ) : visible.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                backgroundColor: isDark ? colors.surface : Theme.cardWhite,
                borderColor: cardBorder,
              },
            ]}
          >
            <MapPin size={22} color={colors.emerald} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No open loads right now
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              When businesses broadcast marketplace demand, it appears here.
            </Text>
          </View>
        ) : (
          visible.map((load) => (
            <LoadCard
              key={load.id}
              load={load}
              compatible={isLoadCompatibleWithFleet(load, fleetTypes)}
              bidStatus={bidStatusByIndentId.get(load.id)}
              onOpenDetail={() =>
                router.push(
                  ROUTES.driverAvailableLoad(load.id) as Parameters<typeof router.push>[0],
                )
              }
              onBid={() =>
                router.push(
                  ROUTES.driverAvailableLoad(load.id, { bid: true }) as Parameters<
                    typeof router.push
                  >[0],
                )
              }
            />
          ))
        )}
      </View>
    </View>
  );
}

function LoadCard({
  load,
  compatible,
  bidStatus,
  onOpenDetail,
  onBid,
}: {
  load: FleetOwnerOpenLoad;
  compatible: boolean;
  bidStatus?: MarketBidStatus;
  onOpenDetail: () => void;
  onBid: () => void;
}) {
  const rate = formatFleetOwnerRateOffer(load.rate_offer);
  const shipper = (load.creator_organization_name ?? '').trim() || 'Shipper';
  const isAwarded = bidStatus === 'accepted';
  const isQuoted = bidStatus === 'pending';
  const isClosed =
    bidStatus === 'rejected' || bidStatus === 'superseded' || bidStatus === 'withdrawn';

  let primary: Parameters<typeof DriverWorkOpportunityCard>[0]['primaryCta'] = {
    title: 'Bid Now',
    hint: rate ? `Shipper target ${rate}` : 'Offer your rate to the shipper',
    onPress: onBid,
  };
  if (isAwarded) {
    primary = { title: 'Open job', hint: 'Awarded — continue on Dashboard', onPress: onOpenDetail };
  } else if (isQuoted) {
    primary = {
      title: 'Revise bid',
      hint: rate ? `Target ${rate}` : 'Update your quoted bid',
      onPress: onBid,
      variant: 'quoted',
    };
  } else if (isClosed) {
    primary = {
      title: marketBidStatusLabel(bidStatus!),
      variant: 'info',
      onPress: onOpenDetail,
    };
  }

  return (
    <DriverWorkOpportunityCard
      orgName={shipper}
      orgLogoUrl={load.creator_organization_logo_url}
      orgAvatarSeed={load.creator_organization_avatar_seed}
      orgSeed={load.creator_organization_id ?? load.id}
      kicker={
        isAwarded
          ? 'Job · Awarded'
          : isQuoted
            ? 'Quoted bid'
            : isClosed
              ? marketBidStatusLabel(bidStatus!)
              : 'Market'
      }
      badge={isAwarded ? 'awarded' : isQuoted ? 'quoted' : isClosed ? null : 'open'}
      origin={load.pickup_area}
      destination={load.drop_location}
      vehicleType={load.vehicle_type}
      material={load.load_type}
      pickupDate={load.pickup_date}
      fleetMatch={compatible && !isAwarded}
      targetLabel={isAwarded ? 'Awarded rate' : isQuoted ? 'Shipper target' : 'Shipper target'}
      targetValue={rate}
      primaryCta={primary}
      secondaryCta={{
        title: isAwarded ? 'Open job' : 'Full view',
        onPress: onOpenDetail,
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gateBody: { fontSize: 12, lineHeight: 17 },
  marketSection: { paddingTop: 16, gap: 10, paddingBottom: 8 },
  marketGate: {
    paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  marketListPad: { paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD, gap: 12 },
  marketplaceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
    marginBottom: 2,
  },
  marketplaceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
    marginBottom: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingVertical: 8,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1, lineHeight: 15 },
  empty: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  emptyTitle: { fontSize: 13, fontWeight: '700', letterSpacing: -0.15 },
  emptyBody: { fontSize: 12, lineHeight: 17 },
  cta: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { color: Theme.textOnPrimary, fontSize: 13, fontWeight: '700' },
  errorText: { color: Theme.negative, fontSize: 12, fontWeight: '600' },
});
