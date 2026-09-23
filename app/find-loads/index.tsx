/**
 * A4.3 — Business Find Loads: open Marketplace discovery, separate from Load
 * Center's relationship-based Get Load tab (features/network/utils/loadCenter.model.ts).
 * "Source" (All / Sponsored / Marketplace) is a distribution signal on one feed,
 * not three separate workflows — see docs/MARKETPLACE_DOMAIN.md
 * "Distribution vs monetization".
 *
 * A4.4 Phase 1 — persist an organization Market bid (market_bids,
 * bidder_type='organization'). The amount UI is the same Network / Get Load
 * keypad (MarketLoadBidSheet) on desktop and mobile. No vehicle at bid time —
 * fleet/driver is chosen at allocation after award (A4.4 Phase 3).
 */
import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import { PartyAvatar } from "@/components/PartyAvatar";
import { MarketLoadBidSheet } from "@/features/driver/components/MarketLoadBidSheet";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import {
  MarketplaceRouteGrid,
  MarketplaceSpecChips,
  titleCaseWord,
} from "@/features/network/components/MarketplaceLoadCardChrome";
import { MarketplaceLaneFilters } from "@/features/network/components/MarketplaceLaneFilters";
import { MarketplaceSearchSheet } from "@/features/network/components/MarketplaceSearchSheet";
import { OrgMyBidsList } from "@/features/network/components/OrgMyBidsList";
import {
  composeFindLoadsOpportunity,
  findLoadsDisplayId,
  findLoadsRouteLabel,
  formatFindLoadsRateOffer,
  listMarketplaceSearchLanes,
  listMyOrgMarketBids,
  listOpenMarketplaceLoadsPage,
  submitOrgMarketBid,
  type OrgOpenMarketplaceLoad,
} from "@/features/network/services/findLoadsForOrg.service";
import { MARKETPLACE_LOAD_PAGE_SIZE } from "@/features/network/utils/marketplaceLoadsPage.util";
import {
  isMarketplaceSearchReady,
  marketplaceSearchKey,
  type MarketplaceLoadSearch,
} from "@/features/network/utils/marketplaceSearch.util";
import { formatStoryDate } from "@/features/network/utils/storyDisplay";
import { STALE } from "@/lib/queryClient";
import { isVehicleTypeCompatibleWithFleet } from "@/features/marketplace/utils/fleetFit.util";
import { formatMarketplaceTransactionError } from "@/features/marketplace/utils/marketplaceErrorFormat.util";
import { getVehiclesByOrganization } from "@/features/vehicles/services/vehicles.service";
import { showAppAlert } from "@/lib/appAlert";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { queryKeys } from "@/lib/queryKeys";
import { ROUTES } from "@/lib/routes";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Award, ChevronRight, SlidersHorizontal, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type SourceFilter = "all" | "sponsored" | "marketplace";
type Segment = "discover" | "myBids";

const FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sponsored", label: "Sponsored" },
  { id: "marketplace", label: "Marketplace" },
];


export default function FindLoadsScreen() {
  const layout = useLayoutInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgCtx = useOptionalOrganization();
  const organization = orgCtx?.currentOrganization ?? null;
  const orgLoading = orgCtx?.isLoading ?? orgCtx == null;
  const { can: canSurface, isLoading: accessLoading } = useMemberAccess();
  // Reuses Load Center's hub gate for this first version rather than a
  // dedicated "Find Loads" surface — see A4.3 report.
  const canViewFindLoads = canSurface("tripops.pulse_loads");
  const orgId = canViewFindLoads ? organization?.id ?? null : null;

  const [filter, setFilter] = useState<SourceFilter>("all");
  const [segment, setSegment] = useState<Segment>("discover");
  const [bidLoad, setBidLoad] = useState<OrgOpenMarketplaceLoad | null>(null);
  const [bidError, setBidError] = useState<string | undefined>();
  const [appliedSearch, setAppliedSearch] = useState<MarketplaceLoadSearch | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const searchReady = isMarketplaceSearchReady(appliedSearch);

  const contentTopInset = layout.isDesktopWeb
    ? Layout.desktopTopNavOffset
    : layout.top;

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(ROUTES.PULSE_LOADS as import("expo-router").Href);
  };

  const loadsQ = useInfiniteQuery({
    queryKey: queryKeys.findLoadsForOrg.infinite(
      orgId ?? "",
      MARKETPLACE_LOAD_PAGE_SIZE,
      searchReady ? marketplaceSearchKey(appliedSearch) : "",
    ),
    queryFn: async ({ pageParam }) => {
      const { error, loads, nextOffset } = await listOpenMarketplaceLoadsPage(
        orgId as string,
        pageParam,
        MARKETPLACE_LOAD_PAGE_SIZE,
        appliedSearch,
      );
      if (error) throw error;
      return { loads, nextOffset };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!orgId && searchReady && segment === "discover",
    staleTime: STALE.frequent,
  });
  const loads = useMemo(
    () => loadsQ.data?.pages.flatMap((page) => page.loads) ?? [],
    [loadsQ.data],
  );

  const vehiclesQ = useQuery({
    queryKey: queryKeys.vehicles.all(orgId ?? ""),
    queryFn: () => getVehiclesByOrganization(orgId as string),
    enabled: !!orgId,
  });
  const fleetVehicleTypes = useMemo(
    () => (vehiclesQ.data?.vehicles ?? []).map((v) => v.vehicle_type),
    [vehiclesQ.data],
  );

  const myBidsQ = useQuery({
    queryKey: queryKeys.findLoadsForOrg.myBids(orgId ?? ""),
    queryFn: () => listMyOrgMarketBids(orgId as string),
    enabled: !!orgId,
  });
  const lanesQ = useQuery({
    queryKey: queryKeys.findLoadsForOrg.searchLanes(orgId ?? ""),
    queryFn: async () => {
      const { error, lanes } = await listMarketplaceSearchLanes(orgId as string);
      if (error && lanes.length === 0) throw error;
      return lanes;
    },
    enabled: !!orgId && segment === "discover",
    staleTime: STALE.moderate,
  });
  const myBids = myBidsQ.data?.bids ?? [];
  const awardedCount = useMemo(
    () => myBids.filter((b) => b.status === "accepted").length,
    [myBids],
  );

  const viewerCanBidCapability =
    (organization?.capabilities?.canBid ?? true) &&
    canSurface("sales.marketplace.bid");

  const filteredLoads = useMemo(() => {
    if (filter === "sponsored") return loads.filter((l) => l.is_sponsored);
    if (filter === "marketplace") return loads.filter((l) => !l.is_sponsored);
    return loads;
  }, [loads, filter]);
  const discoverColumns = layout.isDesktopWeb ? 3 : 1;

  const submitMarketplaceBid = async (amount: number): Promise<boolean> => {
    if (!bidLoad) return false;
    const { error } = await submitOrgMarketBid(orgId, bidLoad.id, amount, "");
    if (error) {
      setBidError(formatMarketplaceTransactionError(error.message));
      return false;
    }
    return true;
  };

  const handleBidSuccess = () => {
    setBidLoad(null);
    setBidError(undefined);
    if (orgId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.findLoadsForOrg.list(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.findLoadsForOrg.infinite(
          orgId,
          MARKETPLACE_LOAD_PAGE_SIZE,
          searchReady ? marketplaceSearchKey(appliedSearch) : "",
        ),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.findLoadsForOrg.myBids(orgId) });
    }
    showAppAlert("Bid submitted", "The business will review your offer.");
  };

  if (accessLoading) {
    return <ChromeBelowTopNavLoadingScreen variant="preparing" />;
  }
  if (!canViewFindLoads) {
    return (
      <View style={[styles.centered, { paddingTop: contentTopInset }]}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeBtn,
            styles.noAccessCloseBtn,
            pressed && styles.closeBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close Marketplace Loads"
          hitSlop={Layout.touchTargetHitSlop}
        >
          <X size={20} color={Theme.textPrimaryDark} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.message}>You don't have access to Marketplace Loads.</Text>
      </View>
    );
  }
  if (!orgId) {
    return <ChromeBelowTopNavLoadingScreen variant={orgLoading ? "preparing" : "generic"} />;
  }

  const shownCount = filteredLoads.length;
  const headerSubtitle =
    segment === "myBids"
      ? `${myBids.length} bid${myBids.length === 1 ? "" : "s"} from your org`
      : !searchReady
        ? "Pick a lane to browse open loads"
        : loadsQ.isLoading
          ? "Finding loads on this route…"
          : `${shownCount} matching load${shownCount === 1 ? "" : "s"}`;

  const pageChrome = () => (
      <View
        style={[
          styles.chrome,
          layout.isDesktopWeb && styles.chromeDesktop,
        ]}
      >
        <View style={styles.chromeInner}>
          {awardedCount > 0 ? (
            <Pressable
              onPress={() => setSegment("myBids")}
              style={({ pressed }) => [
                styles.awardedBanner,
                pressed && styles.awardedBannerPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open awarded bids"
            >
              <View style={styles.awardedBannerIcon}>
                <Award size={15} color={Theme.positive} strokeWidth={2.2} />
              </View>
              <Text style={styles.awardedBannerText} numberOfLines={2}>
                {awardedCount === 1
                  ? "You have 1 awarded bid — assign a vehicle to get started"
                  : `You have ${awardedCount} awarded bids — assign vehicles to get started`}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <View style={styles.headerAccent} />
              <View style={styles.headerTextCol}>
                <Text style={styles.eyebrow} numberOfLines={1}>
                  LIVE MARKETPLACE
                </Text>
                <Text
                  style={[styles.title, layout.isDesktopWeb && styles.titleDesktop]}
                  numberOfLines={1}
                >
                  Marketplace Loads
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {headerSubtitle}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {segment === "myBids" ? (
                <Pressable
                  onPress={() => setSegment("discover")}
                  style={({ pressed }) => [
                    styles.segmentChip,
                    pressed && styles.awardedBannerPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Discover"
                >
                  <Text style={styles.segmentChipText}>Discover</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setSegment("myBids")}
                style={({ pressed }) => [
                  styles.segmentChip,
                  segment === "myBids" && styles.segmentChipActive,
                  pressed && styles.awardedBannerPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="My Bids"
              >
                <Text
                  style={[
                    styles.segmentChipText,
                    segment === "myBids" && styles.segmentChipTextActive,
                  ]}
                >
                  My Bids
                </Text>
              </Pressable>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close Marketplace Loads"
                hitSlop={Layout.touchTargetHitSlop}
              >
                <X size={18} color={Theme.textPrimaryDark} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>

          {segment === "discover" ? (
            <View style={styles.lanePanel}>
              <View style={styles.lanePanelHead}>
                <Text style={styles.lanePanelHint}>
                  Filter by pickup, drop, then vehicle
                </Text>
                <Pressable
                  onPress={() => setFilterOpen(true)}
                  style={({ pressed }) => [
                    styles.filterIconBtn,
                    pressed && styles.closeBtnPressed,
                    searchReady && styles.filterIconBtnActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Filter marketplace loads"
                >
                  <SlidersHorizontal
                    size={16}
                    color={
                      searchReady ? Theme.textOnPrimary : Theme.textPrimaryDark
                    }
                    strokeWidth={2.2}
                  />
                </Pressable>
              </View>
              <MarketplaceLaneFilters
                lanes={lanesQ.data ?? []}
                value={appliedSearch}
                onChange={setAppliedSearch}
                autoOpenFirst
              />
              {searchReady ? (
                <View style={styles.filterRow}>
                  {FILTERS.map((f) => {
                    const active = filter === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => setFilter(f.id)}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            active && styles.filterChipTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );

  const discoverBody = !searchReady ? (
    <View style={styles.pageBody}>
      <Text style={styles.message}>
        Choose pickup, then drop, then vehicle from the lists above.
      </Text>
    </View>
  ) : loadsQ.isError ? (
    <View style={styles.pageBody}>
      <Text style={styles.message}>Couldn't load Marketplace loads.</Text>
      <Pressable
        onPress={() => loadsQ.refetch()}
        style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Retry"
      >
        <Text style={styles.retryBtnText}>Retry</Text>
      </Pressable>
    </View>
  ) : loadsQ.isLoading ? (
    <View style={styles.pageBody}>
      <Text style={styles.message}>Finding loads on this route…</Text>
    </View>
  ) : filteredLoads.length === 0 ? (
    <View style={styles.pageBody}>
      <Text style={styles.message}>No Marketplace loads on this route.</Text>
      <Pressable
        onPress={() => setFilterOpen(true)}
        style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Change marketplace filters"
      >
        <Text style={styles.retryBtnText}>Change filters</Text>
      </Pressable>
    </View>
  ) : null;

  const showDiscoverCards = segment === "discover" && discoverBody == null;

  return (
    <View style={[styles.root, { paddingTop: contentTopInset }]}>
      {segment === "myBids" ? (
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
        >
          {pageChrome()}
          <OrgMyBidsList
            bids={myBids}
            isLoading={myBidsQ.isLoading}
            onPaymentUpdated={() => {
              if (orgId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.findLoadsForOrg.myBids(orgId) });
              }
            }}
          />
        </ScrollView>
      ) : showDiscoverCards ? (
        <FlatList
          data={filteredLoads}
          key={`discover-${discoverColumns}`}
          numColumns={discoverColumns}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            layout.isDesktopWeb && styles.listContentDesktop,
          ]}
          columnWrapperStyle={
            discoverColumns > 1 ? styles.listRow : undefined
          }
          ListHeaderComponent={pageChrome}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (loadsQ.hasNextPage && !loadsQ.isFetchingNextPage) {
              void loadsQ.fetchNextPage();
            }
          }}
          ListFooterComponent={
            loadsQ.isFetchingNextPage ? (
              <View style={styles.loadMoreWrap}>
                <Text style={styles.loadMoreHint}>Loading more…</Text>
              </View>
            ) : loadsQ.hasNextPage ? (
              <Pressable
                onPress={() => void loadsQ.fetchNextPage()}
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  pressed && styles.retryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Load more marketplace loads"
              >
                <Text style={styles.retryBtnText}>Load more</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <FindLoadsCard
              load={item}
              fitsFleet={isVehicleTypeCompatibleWithFleet(item.vehicle_type, fleetVehicleTypes)}
              viewerCanBidCapability={viewerCanBidCapability}
              viewerOrgId={orgId}
              isDesktop={!!layout.isDesktopWeb}
              onPress={() => setBidLoad(item)}
            />
          )}
        />
      ) : (
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
        >
          {pageChrome()}
          {discoverBody}
        </ScrollView>
      )}

      <MarketLoadBidSheet
        visible={bidLoad != null}
        onClose={() => {
          setBidLoad(null);
          setBidError(undefined);
        }}
        onSubmitAmount={submitMarketplaceBid}
        onSuccessDone={handleBidSuccess}
        shipperName={bidLoad?.creator_organization_name}
        pickup={bidLoad?.pickup_area}
        drop={bidLoad?.drop_location}
        vehicleType={bidLoad?.vehicle_type}
        loadType={bidLoad?.load_type}
        targetRateInr={bidLoad?.rate_offer}
        indentDisplayId={bidLoad ? findLoadsDisplayId(bidLoad) : null}
        validationError={bidError}
        onClearValidationError={() => setBidError(undefined)}
      />
      <MarketplaceSearchSheet
        visible={filterOpen && segment === "discover"}
        initial={appliedSearch}
        lanes={lanesQ.data ?? []}
        lanesLoading={lanesQ.isLoading}
        eyebrow="Marketplace"
        title="Search live loads"
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setAppliedSearch(next);
          setFilterOpen(false);
        }}
      />
    </View>
  );
}

function FindLoadsCard({
  load,
  fitsFleet,
  viewerCanBidCapability,
  viewerOrgId,
  isDesktop = false,
  onPress,
}: {
  load: OrgOpenMarketplaceLoad;
  fitsFleet: boolean;
  viewerCanBidCapability: boolean;
  viewerOrgId: string;
  isDesktop?: boolean;
  onPress: () => void;
}) {
  const opportunity = useMemo(
    () => composeFindLoadsOpportunity(load, viewerOrgId, viewerCanBidCapability),
    [load, viewerOrgId, viewerCanBidCapability],
  );
  const rate = formatFindLoadsRateOffer(load.rate_offer);
  const biddable = opportunity.bidding.canBid;
  const shipperRaw = (load.creator_organization_name ?? "").trim() || "Unknown shipper";
  const shipper = titleCaseWord(shipperRaw);
  const specChips = [load.vehicle_type, load.load_type]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .map(titleCaseWord);
  const dateLabel = load.pickup_date ? formatStoryDate(load.pickup_date) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!biddable}
      style={({ pressed }) => [
        styles.card,
        isDesktop && styles.cardDesktop,
        !biddable && styles.cardDisabled,
        pressed && biddable && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${shipper}, ${findLoadsRouteLabel(load)}, ${rate ?? "rate not listed"}`}
    >
      <View style={styles.cardTop}>
        <PartyAvatar
          name={shipper}
          initialsColorSeed={load.creator_organization_id ?? shipper}
          entityType="client"
          size={32}
        />
        <View style={styles.cardTopText}>
          <Text style={styles.orgName} numberOfLines={1}>
            {shipper}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {findLoadsDisplayId(load)}
          </Text>
        </View>
        {load.is_sponsored || fitsFleet ? (
          <View style={styles.badgeStack}>
            {load.is_sponsored ? (
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredBadgeText}>Sponsored</Text>
              </View>
            ) : null}
            {fitsFleet ? (
              <View style={styles.fitBadge}>
                <Text style={styles.fitBadgeText}>Fleet fit</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <MarketplaceRouteGrid pickup={load.pickup_area} drop={load.drop_location} />
      <MarketplaceSpecChips chips={specChips} dateLabel={dateLabel} />

      <View style={styles.cardFooter}>
        <View style={styles.rateBlock}>
          <Text style={styles.rateLabel}>Target rate</Text>
          <Text style={styles.rate}>{rate ?? "—"}</Text>
        </View>
        {biddable ? (
          <View style={styles.bidCta}>
            <Text style={styles.bidCtaText}>Bid</Text>
            <ChevronRight size={13} color={Theme.buttonPrimaryText} strokeWidth={2.4} />
          </View>
        ) : (
          <Text style={styles.notYetBiddable}>No bidding access</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.analyticsCanvas },
  pageScroll: {
    flex: 1,
    width: "100%",
  },
  pageScrollContent: {
    flexGrow: 1,
    width: "100%",
    paddingBottom: 32,
  },
  pageBody: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: { fontSize: 16, color: Theme.textSecondary },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Theme.buttonPrimary,
  },
  retryBtnPressed: { opacity: 0.85 },
  retryBtnText: { fontSize: 14, fontWeight: "700", color: Theme.buttonPrimaryText },
  loadMoreWrap: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loadMoreHint: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 20,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Theme.buttonPrimary,
    justifyContent: "center",
  },
  chrome: {
    backgroundColor: Theme.cardWhite,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  chromeDesktop: {
    paddingHorizontal: 32,
  },
  chromeInner: {
    width: "100%",
    gap: 12,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    width: "100%",
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAccent: {
    width: 4,
    height: 44,
    borderRadius: 999,
    backgroundColor: Theme.primary,
    flexShrink: 0,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: Theme.textMuted,
  },
  lanePanel: {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.surfaceBorder,
    gap: 10,
  },
  lanePanelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  lanePanelHint: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  closeBtn: {
    width: Layout.minTouchTargetSize,
    height: Layout.minTouchTargetSize,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  closeBtnPressed: { opacity: 0.85 },
  noAccessCloseBtn: {
    position: "absolute",
    top: 12,
    right: 16,
  },
  awardedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Theme.positiveMuted,
    borderWidth: 1,
    borderColor: Theme.positiveMutedDarkBorder,
  },
  awardedBannerPressed: { opacity: 0.88 },
  awardedBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  awardedBannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.primaryText,
    lineHeight: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.4,
  },
  titleDesktop: {
    fontSize: 26,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
  segmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    justifyContent: "center",
  },
  segmentChipActive: {
    backgroundColor: Theme.primaryText,
    borderColor: Theme.primaryText,
  },
  segmentChipText: { fontSize: 13, fontWeight: "600", color: Theme.primaryText },
  segmentChipTextActive: { color: Theme.textOnPrimary },
  filterIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconBtnActive: {
    backgroundColor: Theme.primary,
    borderColor: Theme.primary,
  },
  myBidsScroll: { paddingTop: 12, paddingBottom: 32 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 32,
    borderRadius: 20,
    backgroundColor: Theme.brandBlueSoft,
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: Theme.primary },
  filterChipText: { fontSize: 12, fontWeight: "600", color: Theme.primary },
  filterChipTextActive: { color: Theme.textOnPrimary },
  list: {
    flex: 1,
    width: "100%",
  },
  listContent: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  listContentDesktop: {
    paddingHorizontal: 32,
  },
  listRow: {
    gap: 16,
    width: "100%",
    paddingHorizontal: 0,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.surfaceBorder,
    padding: 16,
    backgroundColor: Theme.cardWhite,
    marginBottom: 12,
    gap: 14,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: `0 8px 20px ${Theme.actionAccentShadow}`,
      } as object,
      default: {
        shadowColor: Theme.primaryText,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  cardDesktop: {
    width: "calc((100% - 32px) / 3)" as unknown as number,
    maxWidth: "calc((100% - 32px) / 3)" as unknown as number,
    minWidth: 0,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 0,
  },
  cardPressed: { opacity: 0.92 },
  cardDisabled: { opacity: 0.72 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTopText: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
  },
  orgName: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  metaLine: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  badgeStack: { alignItems: "flex-end", justifyContent: "center", gap: 4, flexShrink: 0 },
  sponsoredBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Theme.brandBlue,
  },
  sponsoredBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.brandBlueInk,
  },
  fitBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Theme.positiveMuted,
  },
  fitBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.positive,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.surfaceBorder,
  },
  rateBlock: { gap: 2, minWidth: 0, flex: 1 },
  rateLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.45,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  rate: { fontSize: 16, fontWeight: "700", color: Theme.primary, letterSpacing: -0.3 },
  bidCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
  },
  bidCtaText: { fontSize: 12, fontWeight: "700", color: Theme.buttonPrimaryText },
  notYetBiddable: { fontSize: 11, color: Theme.textMuted, fontStyle: "italic" },
});
