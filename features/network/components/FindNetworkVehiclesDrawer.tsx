/**
 * Find network opportunities drawer.
 * mode give = idle vehicles · mode get = advertised marketplace loads.
 * Desktop: right-side drawer. Filters: search, vehicle type, pickup, drop.
 * Opens the same story-detail page on select.
 */
import Theme from "@/constants/Theme";
import { ResponsiveDrawer } from "@/components/ResponsiveDrawer";
import type { IndentRow } from "@/features/indents";
import {
  OpportunityCard,
  useLoadCenterOpportunityPosts,
  type LoadCenterOpportunityMode,
} from "@/features/network/components/LoadCenterOpportunityExchange";
import { useScrollPagedItems } from "@/features/network/hooks/useScrollPagedItems";
import { MARKETPLACE_LOAD_PAGE_SIZE } from "@/features/network/utils/marketplaceLoadsPage.util";
import type { PostRow } from "@/features/network/services/posts.service";
import { splitLocationParts } from "@/features/network/utils/storyDisplay";
import { Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const DRAWER_WIDTH = 440;
const FIND_CANVAS = "#F0F2F5";

export type FindNetworkVehiclesDrawerProps = {
  visible: boolean;
  onClose: () => void;
  orgId: string | null;
  /** give = idle vehicles · get = advertised marketplace loads */
  mode?: LoadCenterOpportunityMode;
  supplierOrgIds?: ReadonlySet<string>;
  clientOrgIds?: ReadonlySet<string>;
  /** Get Load: advertised network indent catalog (full list for metrics). */
  indentLoads?: IndentRow[];
  renderIndentCard?: (load: IndentRow) => ReactNode;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function postMatchesFilters(
  post: PostRow,
  filters: {
    search: string;
    vehicleType: string;
    pickup: string;
    drop: string;
  },
): boolean {
  const search = norm(filters.search);
  const vehicleFilter = norm(filters.vehicleType);
  const pickupFilter = norm(filters.pickup);
  const dropFilter = norm(filters.drop);

  const vehicle = norm(post.vehicle_type);
  const origin = norm(post.origin);
  const dest = norm(post.destination);
  const org = norm(post.org_name);
  const material = norm(post.material);
  const originCity = norm(splitLocationParts(post.origin).city);
  const destCity = norm(
    splitLocationParts(post.destination || "Anywhere").city,
  );

  if (vehicleFilter && vehicleFilter !== "all" && !vehicle.includes(vehicleFilter)) {
    return false;
  }
  if (pickupFilter && !origin.includes(pickupFilter) && !originCity.includes(pickupFilter)) {
    return false;
  }
  if (dropFilter && !dest.includes(dropFilter) && !destCity.includes(dropFilter)) {
    return false;
  }
  if (search) {
    const hay = [org, vehicle, origin, dest, material, originCity, destCity].join(
      " ",
    );
    if (!hay.includes(search)) return false;
  }
  return true;
}

function indentMatchesFilters(
  load: IndentRow,
  filters: {
    search: string;
    vehicleType: string;
    pickup: string;
    drop: string;
  },
): boolean {
  const search = norm(filters.search);
  const vehicleFilter = norm(filters.vehicleType);
  const pickupFilter = norm(filters.pickup);
  const dropFilter = norm(filters.drop);
  const vehicle = norm(load.vehicle_type);
  const origin = norm(load.pickup_area);
  const dest = norm(load.drop_location);
  const org = norm(load.creator_organization_name ?? load.client_name);
  const material = norm(load.load_type);

  if (vehicleFilter && vehicleFilter !== "all" && !vehicle.includes(vehicleFilter)) {
    return false;
  }
  if (pickupFilter && !origin.includes(pickupFilter)) return false;
  if (dropFilter && !dest.includes(dropFilter)) return false;
  if (search) {
    const hay = [org, vehicle, origin, dest, material].join(" ");
    if (!hay.includes(search)) return false;
  }
  return true;
}

export function FindNetworkVehiclesDrawer({
  visible,
  onClose,
  orgId,
  mode = "give",
  supplierOrgIds,
  clientOrgIds,
  indentLoads,
  renderIndentCard,
}: FindNetworkVehiclesDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isGet = mode === "get";

  const { posts, isLoading, viewerBidByPostId, orgProfileMap } =
    useLoadCenterOpportunityPosts(
      orgId,
      mode,
      supplierOrgIds,
      clientOrgIds,
    );

  const [search, setSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("all");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");

  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setVehicleType("all");
    setPickup("");
    setDrop("");
  }, [visible, mode]);

  const useIndentCatalog = Boolean(
    isGet && renderIndentCard && (indentLoads?.length ?? 0) > 0,
  );

  const vehicleTypes = useMemo(() => {
    const set = new Set<string>();
    if (useIndentCatalog) {
      for (const load of indentLoads ?? []) {
        const v = load.vehicle_type?.trim();
        if (v) set.add(v);
      }
    } else {
      for (const p of posts) {
        const v = p.vehicle_type?.trim();
        if (v) set.add(v);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [useIndentCatalog, indentLoads, posts]);

  const filteredIndents = useMemo(
    () =>
      (indentLoads ?? []).filter((load) =>
        indentMatchesFilters(load, { search, vehicleType, pickup, drop }),
      ),
    [indentLoads, search, vehicleType, pickup, drop],
  );

  const filteredPosts = useMemo(
    () =>
      posts.filter((p) =>
        postMatchesFilters(p, { search, vehicleType, pickup, drop }),
      ),
    [posts, search, vehicleType, pickup, drop],
  );

  const {
    visibleItems: visibleIndents,
    hasMore: hasMoreIndents,
    remaining: remainingIndents,
    onScroll: onIndentScroll,
  } = useScrollPagedItems(
    filteredIndents,
    MARKETPLACE_LOAD_PAGE_SIZE,
    `find-indents:${orgId ?? ""}:${search}:${vehicleType}:${pickup}:${drop}`,
  );

  const {
    visibleItems: visiblePosts,
    hasMore: hasMorePosts,
    remaining: remainingPosts,
    onScroll: onPostScroll,
  } = useScrollPagedItems(
    filteredPosts,
    MARKETPLACE_LOAD_PAGE_SIZE,
    `find-posts:${orgId ?? ""}:${search}:${vehicleType}:${pickup}:${drop}`,
  );

  const filteredCount = useIndentCatalog
    ? filteredIndents.length
    : filteredPosts.length;

  const openStory = (post: PostRow) => {
    onClose();
    router.push({
      pathname: "/(modals)/story-detail",
      params: {
        postId: post.id,
        ...(post.organization_id ? { orgId: post.organization_id } : {}),
        storyType: post.type,
      },
    });
  };

  const clearFilters = () => {
    setSearch("");
    setVehicleType("all");
    setPickup("");
    setDrop("");
  };

  const hasActiveFilters =
    search.trim().length > 0 ||
    vehicleType !== "all" ||
    pickup.trim().length > 0 ||
    drop.trim().length > 0;

  const title = isGet ? "Find load" : "Find vehicles";
  const subtitle = isGet
    ? "Indents from network and advertised loads"
    : "Idle capacity from network and fleet owners";
  const searchPlaceholder = isGet
    ? "Search loads, org, route…"
    : "Search vehicles, org, route…";
  const listNoun = isGet ? "load" : "vehicle";

  const body = (
    <View
      style={[
        styles.panel,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 16 + insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Close"
          hitSlop={8}
        >
          <X size={18} color={Theme.textPrimaryDark} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Search size={14} color={Theme.textMuted} strokeWidth={2.2} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={Theme.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.filterLabel}>Vehicle type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setVehicleType("all")}
            style={[styles.chip, vehicleType === "all" && styles.chipOn]}
          >
            <Text
              style={[styles.chipText, vehicleType === "all" && styles.chipTextOn]}
            >
              All
            </Text>
          </Pressable>
          {vehicleTypes.map((type) => {
            const on = norm(vehicleType) === norm(type);
            return (
              <Pressable
                key={type}
                onPress={() => setVehicleType(type)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          style={styles.filterInput}
          placeholder="Search vehicle type…"
          placeholderTextColor={Theme.textMuted}
          value={vehicleType === "all" ? "" : vehicleType}
          onChangeText={(t) => setVehicleType(t.trim() ? t : "all")}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.routeFilters}>
        <View style={styles.routeField}>
          <Text style={styles.filterLabel}>Pickup</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Search pickup…"
            placeholderTextColor={Theme.textMuted}
            value={pickup}
            onChangeText={setPickup}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.routeField}>
          <Text style={styles.filterLabel}>Drop</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Search drop…"
            placeholderTextColor={Theme.textMuted}
            value={drop}
            onChangeText={setDrop}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listCount}>
          {isLoading && !useIndentCatalog
            ? "Loading…"
            : (() => {
                const bidded = isGet && !useIndentCatalog
                  ? filteredPosts.filter((p) => viewerBidByPostId.has(p.id)).length
                  : 0;
                const base = `${filteredCount} ${listNoun}${filteredCount === 1 ? "" : "s"}`;
                return bidded > 0 ? `${base} · ${bidded} already bidded` : base;
              })()}
        </Text>
        {hasActiveFilters ? (
          <Pressable onPress={clearFilters} hitSlop={8}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading && !useIndentCatalog && posts.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="small" color={Theme.primary} />
        </View>
      ) : filteredCount === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {isGet ? "No loads match" : "No vehicles match"}
          </Text>
          <Text style={styles.emptySub}>
            Try another vehicle type, pickup, or drop.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
          onScroll={useIndentCatalog ? onIndentScroll : onPostScroll}
          scrollEventThrottle={16}
        >
          {useIndentCatalog
            ? visibleIndents.map((load) => (
                <View key={load.id}>{renderIndentCard!(load)}</View>
              ))
            : visiblePosts.map((post) => (
                <OpportunityCard
                  key={post.id}
                  post={post}
                  mode={mode}
                  fillWidth
                  viewerBid={viewerBidByPostId.get(post.id) ?? null}
                  orgProfileMap={orgProfileMap}
                  onPress={() => openStory(post)}
                />
              ))}
          {(useIndentCatalog ? hasMoreIndents : hasMorePosts) ? (
            <Text style={styles.moreHint}>
              Scroll for more ·{" "}
              {useIndentCatalog ? remainingIndents : remainingPosts} of{" "}
              {filteredCount} remaining
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );

  if (!visible) return null;

  return (
    <ResponsiveDrawer
      visible={visible}
      onClose={onClose}
      insets={insets}
      desktopWidth={DRAWER_WIDTH}
      tabletWidth={DRAWER_WIDTH}
      mobileVariant="fullScreen"
      applyDrawerInsetPadding={false}
    >
      {body}
    </ResponsiveDrawer>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: FIND_CANVAS,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    lineHeight: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
    borderRadius: 12,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  filterBlock: { gap: 6 },
  filterLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.45,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  chipRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxWidth: 160,
  },
  chipOn: {
    backgroundColor: Theme.textPrimaryDark,
    borderColor: Theme.textPrimaryDark,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textSecondary,
  },
  chipTextOn: { color: Theme.textOnDark },
  filterInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "web" ? 9 : 8,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  routeFilters: {
    flexDirection: "row",
    gap: 8,
  },
  routeField: { flex: 1, minWidth: 0, gap: 6 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 2,
  },
  listCount: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textSecondary,
  },
  clearText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.primary,
  },
  list: { flex: 1, minHeight: 0 },
  listContent: { gap: 12, paddingBottom: 16 },
  moreHint: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    textAlign: "center",
    paddingTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  emptySub: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
});
