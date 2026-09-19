/**
 * Your connections — Metronic split layout (Grow / Recommended partners reference):
 * left intelligent filters + connected-profiles widget, right 4-across card grid.
 */
import { PartyAvatar } from "@/components/PartyAvatar";
import Theme from "@/constants/Theme";
import {
  ConnectionsView,
  type ConnectedOrg,
  type ConnectionFilterTab,
} from "@/features/network/components/ConnectionsView";
import { NetworkDesktopPartnersPerformanceTable } from "@/features/network/components/desktop/NetworkDesktopPartnersPerformanceTable";
import { NetworkDesktopSalesGrowWidget } from "@/features/network/components/desktop/NetworkDesktopSalesGrowWidget";
import { NetworkDesktopSidebarFeatureAd } from "@/features/network/components/desktop/NetworkDesktopSidebarFeatureAd";
import { NetworkDesktopSidebarPromoBanners } from "@/features/network/components/desktop/NetworkDesktopSidebarPromoBanners";
import {
  METRONIC,
  networkDesktopHubStyles as styles,
} from "@/features/network/components/desktop/networkDesktopHub.styles";
import { useProfileHubCompactLayout } from "@/features/party/hooks/useProfileHubCompactLayout";
import {
  NETWORK_HUB_METRONIC_CONNECTION_MOBILE_PAGE_SIZE,
  NETWORK_HUB_METRONIC_CONNECTION_PAGE_SIZE,
} from "@/features/network/constants/networkHubGrid";
import {
  defaultSalesFilters,
  type SalesCrossFilters,
  type SalesRoleFilter,
} from "@/features/network/utils/connectionSalesAnalytics.util";
import { runConnectionInvite } from "@/features/network/utils/connectionInvite.util";
import { ChevronDown, Filter, MoreVertical, Search, UserPlus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, type ViewStyle } from "react-native";

type ConnSortMode = "recommended" | "active" | "alpha";

type Props = {
  orgId: string;
  totalConnections: number;
  connSearch: string;
  onConnSearchChange: (v: string) => void;
  connFilter: ConnectionFilterTab;
  onConnFilterChange: (v: ConnectionFilterTab) => void;
  onOpenProfile: (item: ConnectedOrg) => void;
  onConnectionsComputed?: (connections: ConnectedOrg[]) => void;
  onChatIntegrated?: (item: ConnectedOrg) => void;
  /** Jump to Discover section (merged Network tab). */
  onConnectProfile?: () => void;
  /** Merged Network tab: content-only (parent owns the left sidebar). */
  embedded?: boolean;
  /** Controlled sort when parent owns Intelligent filters. */
  hubSortMode?: ConnSortMode;
  onHubSortModeChange?: (mode: ConnSortMode) => void;
};

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.salesFilterChip, active && styles.salesFilterChipOn]}
    >
      <Text
        style={[
          styles.salesFilterChipText,
          active && styles.salesFilterChipTextOn,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const SIDEBAR_PROFILE_LIMIT = 4;

export function NetworkDesktopConnectionsPanel({
  orgId,
  totalConnections,
  connSearch,
  onConnSearchChange,
  connFilter,
  onConnFilterChange,
  onOpenProfile,
  onConnectionsComputed,
  onChatIntegrated,
  onConnectProfile,
  embedded = false,
  hubSortMode,
  onHubSortModeChange,
}: Props) {
  const layout = useProfileHubCompactLayout();
  const [connections, setConnections] = useState<ConnectedOrg[]>([]);
  const [visiblePageConnections, setVisiblePageConnections] = useState<
    ConnectedOrg[]
  >([]);
  const [localSortMode, setLocalSortMode] = useState<ConnSortMode>("recommended");
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const sortMode = hubSortMode ?? localSortMode;
  const applySortMode = (mode: ConnSortMode) => {
    if (onHubSortModeChange) onHubSortModeChange(mode);
    else setLocalSortMode(mode);
  };

  const handleConnectionsComputed = useCallback((items: ConnectedOrg[]) => {
    setConnections((prev) => {
      if (
        prev.length === items.length &&
        prev.every((row, index) => row.id === items[index]?.id)
      ) {
        return prev;
      }
      return items;
    });
    onConnectionsComputed?.(items);
  }, [onConnectionsComputed]);

  const handleVisiblePageChange = useCallback((items: ConnectedOrg[]) => {
    setVisiblePageConnections((prev) => {
      if (
        prev.length === items.length &&
        prev.every((row, index) => row.id === items[index]?.id)
      ) {
        return prev;
      }
      return items;
    });
  }, []);

  const handleInvitePartner = useCallback(
    async (item: ConnectedOrg) => {
      if (item.is_integrated) return;
      setInvitingId(item.id);
      try {
        await runConnectionInvite(orgId, item);
      } finally {
        setInvitingId(null);
      }
    },
    [orgId],
  );

  const tableConnections =
    visiblePageConnections.length > 0
      ? visiblePageConnections
      : connections.slice(
          0,
          Math.max(
            NETWORK_HUB_METRONIC_CONNECTION_MOBILE_PAGE_SIZE,
            NETWORK_HUB_METRONIC_CONNECTION_PAGE_SIZE,
          ),
        );

  const partnerFilters = useMemo((): SalesCrossFilters => {
    const base = defaultSalesFilters();
    const roles = new Set<SalesRoleFilter>();
    if (connFilter === "CLIENT") roles.add("CLIENT");
    if (connFilter === "SUPPLIER") roles.add("SUPPLIER");
    return {
      ...base,
      search: connSearch,
      roles,
    };
  }, [connSearch, connFilter]);

  const sidebarProfiles = useMemo(
    () => connections.slice(0, SIDEBAR_PROFILE_LIMIT),
    [connections],
  );

  const filtersActive = connFilter !== "ALL" || sortMode !== "recommended";

  const clearFilters = () => {
    onConnFilterChange("ALL");
    applySortMode("recommended");
  };

  const cycleSort = () => {
    applySortMode(
      sortMode === "recommended"
        ? "active"
        : sortMode === "active"
          ? "alpha"
          : "recommended",
    );
  };

  const sortLabel =
    sortMode === "recommended"
      ? "Recommended"
      : sortMode === "active"
        ? "Most active"
        : "A–Z";

  return (
    <View
      style={[
        embedded ? embeddedStyles.body : styles.salesBody,
        !embedded && layout.salesBody,
      ]}
    >
      <View style={[styles.splitRow, layout.splitRow, embedded && { gap: 0 }]}>
        {embedded ? null : (
        <View style={[styles.sidebar, layout.sidebar]}>
          <View style={[styles.salesCard, styles.salesCardPad]}>
            <Text style={styles.cardTitle}>Intelligent filters</Text>
            <Text style={styles.salesFilterHint}>
              Narrow connections by role and activity
            </Text>

            <Text style={styles.salesFilterGroup}>Sort</Text>
            <View style={styles.tagWrap}>
              <FilterChip
                label="Recommended"
                active={sortMode === "recommended"}
                onPress={() => applySortMode("recommended")}
              />
              <FilterChip
                label="Most active"
                active={sortMode === "active"}
                onPress={() => applySortMode("active")}
              />
              <FilterChip
                label="A–Z"
                active={sortMode === "alpha"}
                onPress={() => applySortMode("alpha")}
              />
            </View>

            <Text style={styles.salesFilterGroup}>Role</Text>
            <View style={styles.tagWrap}>
              {(
                [
                  ["ALL", "All"],
                  ["CLIENT", "Clients"],
                  ["SUPPLIER", "Suppliers"],
                  ["DRIVER", "Fleet"],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={connFilter === value}
                  onPress={() => onConnFilterChange(value)}
                />
              ))}
            </View>

            {filtersActive ? (
              <Pressable onPress={clearFilters} style={styles.salesClearBtn}>
                <Text style={styles.salesClearBtnText}>Clear all filters</Text>
              </Pressable>
            ) : null}
          </View>

          <NetworkDesktopSalesGrowWidget
            orgId={orgId}
            onViewAllGrow={onConnectProfile}
          />

          <NetworkDesktopSidebarPromoBanners />

          <NetworkDesktopSidebarFeatureAd layout="square" />

          <View style={[styles.salesCard, styles.salesCardPad]}>
            <Text style={styles.cardTitle}>
              {connections.length} profiles connected
            </Text>
            {sidebarProfiles.map((item, idx) => {
              const tripsCount = item.total_trips ?? 0;
              const entityType =
                item.role === "DRIVER"
                  ? "driver"
                  : item.role === "SUPPLIER"
                    ? "supplier"
                    : "client";
              return (
                <Pressable
                  key={`${item.role}-${item.id}`}
                  onPress={() => onOpenProfile(item)}
                  style={[
                    styles.growConnectedRow,
                    idx === sidebarProfiles.length - 1 &&
                      styles.growConnectedRowLast,
                  ]}
                >
                  <PartyAvatar
                    name={item.name}
                    initialsColorSeed={item.id}
                    avatarUrl={item.avatar_url}
                    avatarSeed={item.avatar_seed}
                    entityType={entityType}
                    size={36}
                  />
                  <View style={styles.salesContributorTextCol}>
                    <Text style={styles.salesContributorName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.salesContributorMeta}>
                      {tripsCount} trips · {item.role.toLowerCase()}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.growConnectedMenu}
                    hitSlop={8}
                    onPress={() => onOpenProfile(item)}
                  >
                    <MoreVertical size={14} color={METRONIC.muted} />
                  </Pressable>
                </Pressable>
              );
            })}
            {sidebarProfiles.length === 0 ? (
              <Text style={styles.salesEmptySide}>
                Connect partners to see them here.
              </Text>
            ) : null}
            {onConnectProfile ? (
              <Pressable
                style={styles.growConnectProfileBtn}
                onPress={onConnectProfile}
                accessibilityRole="button"
                accessibilityLabel="Connect profile"
              >
                <UserPlus size={14} color={METRONIC.text} />
                <Text style={styles.growConnectProfileBtnText}>
                  Connect profile
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        )}

        <View style={[styles.mainCol, layout.mainCol, embedded && { flex: 1, width: "100%" }]}>
          <View style={styles.growSectionHeader}>
            <Text style={styles.growSectionTitle}>Your connections</Text>
            <Text style={styles.growSectionSub}>
              {tableConnections.length > 0
                ? connections.length > tableConnections.length
                  ? `${tableConnections.length} showing · ${connections.length} total`
                  : `${tableConnections.length} showing`
                : `${totalConnections} connections`}
            </Text>
          </View>

          <View style={[styles.salesCard, styles.growToolbarCard]}>
            <View style={styles.growToolbarBottom}>
              <View style={styles.salesTableSearch}>
                <Search size={14} color={METRONIC.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Type name, team…"
                  placeholderTextColor={METRONIC.muted}
                  value={connSearch}
                  onChangeText={onConnSearchChange}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              <Pressable style={styles.growToolbarPill} onPress={cycleSort}>
                <Text style={styles.growToolbarPillText}>{sortLabel}</Text>
                <ChevronDown size={12} color={METRONIC.muted} />
              </Pressable>
              {embedded ? (
                <View style={styles.tagWrap}>
                  {(
                    [
                      ["ALL", "All"],
                      ["CLIENT", "Client"],
                      ["SUPPLIER", "Supplier"],
                      ["DRIVER", "Driver"],
                    ] as const
                  ).map(([value, label]) => (
                    <FilterChip
                      key={value}
                      label={label}
                      active={connFilter === value}
                      onPress={() => onConnFilterChange(value)}
                    />
                  ))}
                </View>
              ) : (
                <Pressable
                  style={styles.growToolbarFilterBtn}
                  onPress={() =>
                    onConnFilterChange(
                      connFilter === "ALL"
                        ? "CLIENT"
                        : connFilter === "CLIENT"
                          ? "SUPPLIER"
                          : connFilter === "SUPPLIER"
                            ? "DRIVER"
                            : "ALL",
                    )
                  }
                >
                  <Filter size={13} color={Theme.textOnPrimary} />
                  <Text style={styles.growToolbarFilterBtnText}>
                    {connFilter === "ALL" ? "Filters" : connFilter}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.connectionsCardsSection}>
            <ConnectionsView
              orgId={orgId}
              embedded
              hubMode
              desktopMetronicGrid
              hubSearch={connSearch}
              hubFilter={connFilter}
              hubSortMode={sortMode}
              onOpenProfile={onOpenProfile}
              onConnectionsComputed={handleConnectionsComputed}
              onVisiblePageChange={handleVisiblePageChange}
              onChatIntegrated={onChatIntegrated}
            />
          </View>

          {connections.length === 0 && onConnectProfile ? (
            <View style={[styles.salesCard, styles.salesCardPad]}>
              <Text style={styles.emptyText}>
                {connSearch.trim() || connFilter !== "ALL"
                  ? "No connections match your filters. Try clearing filters."
                  : "No connections yet. Discover partners below to grow your network."}
              </Text>
              <Pressable
                style={[styles.growConnectProfileBtn, { marginTop: 12 }]}
                onPress={onConnectProfile}
              >
                <UserPlus size={14} color={METRONIC.text} />
                <Text style={styles.growConnectProfileBtnText}>
                  Connect profile
                </Text>
              </Pressable>
            </View>
          ) : null}

          <NetworkDesktopPartnersPerformanceTable
            connections={tableConnections}
            trips={[]}
            baseFilters={partnerFilters}
            onOpenProfile={onOpenProfile}
            onInvite={(item) => void handleInvitePartner(item)}
            invitingId={invitingId}
            companyName="Your workspace"
            dateRangeLabel={connFilter === "ALL" ? "All connections" : connFilter}
            dense
          />
        </View>
      </View>
    </View>
  );
}

const embeddedStyles: { body: ViewStyle } = {
  body: {
    width: "100%",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
};
