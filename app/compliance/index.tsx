/**
 * Global Compliance Verification work queue — header, counted stage filters,
 * Cards/Table toggle, and Trip/Vehicle/Driver checklist cards.
 */
import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ComplianceDocumentReviewSheet } from "@/features/tripCompliance/components/ComplianceDocumentReviewSheet";
import { ComplianceTripCard } from "@/features/tripCompliance/components/ComplianceTripCard";
import { ComplianceTripsTable } from "@/features/tripCompliance/components/ComplianceTripsTable";
import { useComplianceProductEnabled } from "@/features/tripCompliance/hooks/useComplianceProductEnabled";
import {
  useComplianceStageFilter,
  useComplianceTripsQuery,
  useInvalidateComplianceTrips,
} from "@/features/tripCompliance/hooks/useComplianceTripsQuery";
import { COMPLIANCE_STAGE_FILTER_LABEL, COMPLIANCE_STAGES } from "@/features/tripCompliance/tripCompliance.types";
import { COMPLIANCE_FILTER_COUNT_TONE, matchesComplianceTripSearch } from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { ROUTES } from "@/lib/routes";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { useRouter } from "expo-router";
import { Download, LayoutGrid, Search, Table2, Wallet } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, type ViewStyle } from "react-native";

function StageChip({
  label,
  count,
  countColor,
  active,
  onPress,
}: {
  label: string;
  count: number;
  countColor: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count > 0 ? (
        <Text style={[styles.chipCount, { color: active ? Theme.buttonDarkText : countColor }]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ComplianceScreen() {
  const layout = useLayoutInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { can: canSurface, isLoading: accessLoading } = useMemberAccess();
  const { enabled: complianceEnabled, isLoading: productsLoading } = useComplianceProductEnabled();
  const canViewCompliance = complianceEnabled && canSurface("trip_compliance.tab");
  const canVerifyDocuments = canSurface("trip_compliance.documents.verify");
  const canManageFinance = canSurface("trip_compliance.finance.manage");
  const canViewFinance = canSurface("trip_compliance.finance.view");
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const { data, isLoading, isError, error } = useComplianceTripsQuery(0);
  const { stage, setStage, filtered, counts } = useComplianceStageFilter(data?.summaries);
  const invalidate = useInvalidateComplianceTrips();
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<{
    tripId: string;
    documentKey: string | null;
    scope: "trip" | "vehicle" | "driver";
  } | null>(null);

  const contentTopInset = layout.isDesktopWeb ? 80 : layout.top;
  const pagePad = 16;
  const gridGap = 8;
  const columns = width >= 1100 ? 3 : width >= 760 ? 2 : 1;
  const usableWidth = Math.max(280, width - pagePad * 2);
  const nativeCardWidth =
    columns === 1 ? usableWidth : Math.floor((usableWidth - gridGap * (columns - 1)) / columns);
  const cardSlotStyle: ViewStyle =
    Platform.OS === "web"
      ? ({
          width: `calc((100% - ${gridGap * (columns - 1)}px) / ${columns})`,
        } as object as ViewStyle)
      : { width: nativeCardWidth };

  const openTrip = useCallback(
    (tripId: string) => {
      router.push(ROUTES.tripDetail(tripId) as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const openDetails = useCallback(
    (tripId: string) => {
      router.push(ROUTES.complianceDetail(tripId) as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const visible = useMemo(
    () => filtered.filter((summary) => matchesComplianceTripSearch(summary, search)),
    [filtered, search],
  );

  const reviewingSummary = useMemo(
    () => (review ? (data?.summaries ?? []).find((s) => s.trip.id === review.tripId) : null),
    [review, data?.summaries],
  );

  if (accessLoading || productsLoading) {
    return <ChromeBelowTopNavLoadingScreen variant="preparing" />;
  }

  if (!canViewCompliance) {
    return (
      <View style={[styles.centered, { paddingTop: contentTopInset }]}>
        <Text style={styles.message}>
          {complianceEnabled
            ? "You don't have access to Compliance."
            : "Compliance is not enabled for this workspace."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: contentTopInset }]}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + layout.bottom, paddingHorizontal: pagePad }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Compliance Verification</Text>
          <View style={styles.headerActions}>
            {canViewFinance ? (
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => router.push(ROUTES.COMPLIANCE_REPORT as Parameters<typeof router.push>[0])}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Download size={13} color={Theme.textPrimary} strokeWidth={2.2} />
                <Text style={styles.reportBtnText}>Export Report</Text>
              </TouchableOpacity>
            ) : null}
            {canManageFinance ? (
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => router.push(ROUTES.COMPLIANCE_BULK_PAYMENT as Parameters<typeof router.push>[0])}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Wallet size={13} color={Theme.complianceBulkText} strokeWidth={2.2} />
                <Text style={styles.bulkBtnText}>Bulk Payment</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={styles.headerMeta}>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>{counts.all} Active Trips</Text>
          </View>
          <Text style={styles.subtitle}>
            Real-time carrier document audit, driver credentials, and settlement milestones.
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Search size={14} color={Theme.textMuted} strokeWidth={2.2} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search trip ID, vehicle, driver, or client"
          placeholderTextColor={Theme.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          accessibilityLabel="Search compliance trips"
        />
      </View>

      <View style={styles.toolbarRow}>
        <View style={styles.chipWrap}>
          <StageChip
            label="All"
            count={counts.all}
            countColor={COMPLIANCE_FILTER_COUNT_TONE.all}
            active={stage === "all"}
            onPress={() => setStage("all")}
          />
          {COMPLIANCE_STAGES.map((s) => (
            <StageChip
              key={s}
              label={COMPLIANCE_STAGE_FILTER_LABEL[s]}
              count={counts[s]}
              countColor={COMPLIANCE_FILTER_COUNT_TONE[s]}
              active={stage === s}
              onPress={() => setStage(s)}
            />
          ))}
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            onPress={() => setViewMode("card")}
            style={[styles.toggleBtn, viewMode === "card" && styles.toggleBtnActive]}
          >
            <LayoutGrid size={13} color={viewMode === "card" ? Theme.buttonDarkText : Theme.textMuted} strokeWidth={2.2} />
            <Text style={[styles.toggleBtnText, viewMode === "card" && styles.toggleBtnTextActive]}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("table")}
            style={[styles.toggleBtn, viewMode === "table" && styles.toggleBtnActive]}
          >
            <Table2 size={13} color={viewMode === "table" ? Theme.buttonDarkText : Theme.textMuted} strokeWidth={2.2} />
            <Text style={[styles.toggleBtnText, viewMode === "table" && styles.toggleBtnTextActive]}>Table</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <Text style={styles.message}>Loading trips…</Text>
      ) : isError ? (
        <Text style={styles.message}>{(error as Error)?.message ?? "Failed to load Compliance."}</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.message}>{search.trim() ? "No trips match your search." : "No trips in this stage."}</Text>
      ) : viewMode === "table" ? (
        <ComplianceTripsTable
          summaries={visible}
          onOpenTrip={openTrip}
          onOpenDetails={openDetails}
          onReview={(tripId, documentKey) => setReview({ tripId, documentKey, scope: "trip" })}
        />
      ) : (
        <View style={[styles.cardGrid, { gap: gridGap }]}>
          {visible.map((summary) => (
            <View key={summary.trip.id} style={cardSlotStyle}>
              <ComplianceTripCard
                summary={summary}
                onReviewDocuments={(scope) => setReview({ tripId: summary.trip.id, documentKey: null, scope })}
                onViewTrip={() => openTrip(summary.trip.id)}
                onOpenDetails={() => openDetails(summary.trip.id)}
              />
            </View>
          ))}
        </View>
      )}

      {reviewingSummary ? (
        <ComplianceDocumentReviewSheet
          visible={review != null}
          onClose={() => setReview(null)}
          tripId={reviewingSummary.trip.id}
          tripLabel={`${reviewingSummary.trip.booking_ref ?? reviewingSummary.trip.id.slice(0, 8)} · ${reviewingSummary.trip.client_name || "Client"}`}
          organizationId={currentOrganization?.id ?? ""}
          actorId={user?.uid ?? null}
          documents={reviewingSummary.documents}
          canVerify={canVerifyDocuments}
          initialSelectedKey={review?.documentKey ?? null}
          onChanged={invalidate}
          scope={review?.scope ?? "trip"}
          vehicleId={reviewingSummary.trip.vehicle_id}
          driverId={reviewingSummary.trip.driver_id}
          vehicleDocuments={reviewingSummary.vehicleDocuments ?? []}
          driverDocuments={reviewingSummary.driverDocuments ?? []}
          vehicleLabel={reviewingSummary.trip.vehicle_display_number?.trim() || "Unassigned"}
          driverLabel={reviewingSummary.trip.driver_display_name?.trim() || "Unassigned"}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.compliancePageBg },
  content: { paddingTop: 6, gap: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Theme.compliancePageBg },
  header: { gap: 4 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: {
    flexGrow: 0,
    flexShrink: 0,
    fontSize: 18,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    lineHeight: 22,
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" as const } : null),
  },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  activeBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.complianceActiveBadgeBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Theme.complianceActiveBadgeFg },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: Theme.complianceActiveBadgeFg },
  subtitle: { flex: 1, minWidth: 180, fontSize: 11, color: Theme.textMuted, lineHeight: 14 },
  headerActions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    paddingVertical: 0,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  bulkBtn: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Theme.complianceBulk,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bulkBtnText: { fontSize: 11, fontWeight: "700", color: Theme.complianceBulkText },
  reportBtn: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reportBtnText: { fontSize: 11, fontWeight: "700", color: Theme.textPrimary },
  toolbarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  chipWrap: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, minWidth: 220 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipActive: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  chipText: { fontSize: 11, fontWeight: "600", color: Theme.textMuted },
  chipTextActive: { color: Theme.buttonDarkText },
  chipCount: { fontSize: 11, fontWeight: "800" },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: Theme.cardWhite,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minHeight: 30,
  },
  toggleBtnActive: { backgroundColor: Theme.buttonDark },
  toggleBtnText: { fontSize: 11, fontWeight: "700", color: Theme.textMuted },
  toggleBtnTextActive: { color: Theme.buttonDarkText },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  message: { fontSize: 12, color: Theme.textMuted, textAlign: "center", paddingVertical: 16 },
});
