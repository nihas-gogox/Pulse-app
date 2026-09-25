/**
 * Global Compliance Verification work queue — header, counted stage filters,
 * Cards/Table toggle, and Trip/Vehicle/Driver checklist cards.
 */
import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import { ComplianceDocumentReviewSheet } from "@/features/tripCompliance/components/ComplianceDocumentReviewSheet";
import { CompliancePaymentConfirmModal } from "@/features/tripCompliance/components/CompliancePaymentConfirmModal";
import { ComplianceTripCard } from "@/features/tripCompliance/components/ComplianceTripCard";
import { ComplianceTripsTable } from "@/features/tripCompliance/components/ComplianceTripsTable";
import { useComplianceProductEnabled } from "@/features/tripCompliance/hooks/useComplianceProductEnabled";
import {
  COMPLIANCE_QUEUE_PAGE_SIZE,
  useComplianceListPagination,
  useComplianceStageFilter,
  useComplianceTripsQuery,
  useComplianceTripQuery,
  useInvalidateComplianceTrips,
} from "@/features/tripCompliance/hooks/useComplianceTripsQuery";
import { postCompliancePayment, markTripComplianceVerified, type ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import { COMPLIANCE_STAGE_FILTER_LABEL, COMPLIANCE_STAGES, type ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { COMPLIANCE_FILTER_COUNT_TONE, matchesComplianceTripSearch } from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { deriveComplianceQueueReadiness } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { formatMarkComplianceVerifiedError } from "@/features/tripCompliance/utils/complianceMarkVerifiedError.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { ROUTES } from "@/lib/routes";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { useRouter } from "expo-router";
import { Download, LayoutGrid, Search, Table2, Wallet } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, type TextStyle, type ViewStyle } from "react-native";

function StageChip({
  label,
  count,
  countColor,
  active,
  onPress,
  compact = false,
}: {
  label: string;
  count: number;
  countColor: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Text
        style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View
          style={[
            styles.chipCountBadge,
            compact && styles.chipCountBadgeCompact,
            { backgroundColor: active ? Theme.buttonDarkText : countColor },
          ]}
        >
          <Text
            style={[
              styles.chipCount,
              compact && styles.chipCountCompact,
              { color: active ? Theme.buttonDark : Theme.buttonDarkText },
            ]}
          >
            {count}
          </Text>
        </View>
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
  const canViewDocuments = canSurface("trip_compliance.documents.view");
  const canVerifyDocuments = canSurface("trip_compliance.documents.verify");
  const canMarkVerified = canSurface("trip_compliance.trip.mark_verified");
  const canManageFinance = canSurface("trip_compliance.finance.manage");
  const canViewFinance = canSurface("trip_compliance.finance.view");
  const { user } = useAuth();
  const orgCtx = useOptionalOrganization();
  const currentOrganization = orgCtx?.currentOrganization ?? null;

  const {
    summaries,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useComplianceTripsQuery();
  const { stage, setStage, filtered, counts } = useComplianceStageFilter(summaries);
  const invalidate = useInvalidateComplianceTrips();
  const markTripVerified = useCallback(
    async (tripId: string) => {
      if (!canMarkVerified) {
        alertMessage("Can't verify", "You don't have permission to mark this trip compliance verified.");
        return;
      }
      if (!user?.uid) {
        alertMessage("Can't verify", "Sign in again, then try Verify Docs.");
        return;
      }
      const { error } = await markTripComplianceVerified({ tripId, actorId: user.uid });
      if (error) {
        alertMessage("Couldn't verify compliance", formatMarkComplianceVerifiedError(error.message));
        return;
      }
      invalidate(tripId);
    },
    [canMarkVerified, invalidate, user?.uid],
  );
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [pay, setPay] = useState<{ summary: ComplianceTripSummary; category: ComplianceLedgerCategory } | null>(null);
  const [paying, setPaying] = useState(false);
  const [review, setReview] = useState<{
    tripId: string;
    documentKey: string | null;
    scope: "trip" | "vehicle" | "driver";
  } | null>(null);

  const searched = useMemo(
    () => filtered.filter((summary) => matchesComplianceTripSearch(summary, search)),
    [filtered, search],
  );
  const {
    page,
    setPage,
    pageItems: visible,
    pageCount,
    total: filteredTotal,
    hasPrev,
    hasNext,
    pageSize,
  } = useComplianceListPagination(searched, {
    pageSize: COMPLIANCE_QUEUE_PAGE_SIZE,
    resetKey: `${stage}|${search.trim()}`,
  });

  const contentTopInset = layout.isDesktopWeb ? Layout.desktopTopNavOffset : layout.top;
  const pagePad = Layout.screenPaddingHorizontal;
  /** Responsive breakpoints for header and toolbar. */
  const isNarrow = width < 560;
  const isCompact = width < 760;
  const stackToolbar = width < 980;
  const compactActions = width < 700;
  const columns = width >= 1100 ? 3 : width >= 760 ? 2 : 1;
  const cardGap = 16;
  const usableWidth = Math.max(280, width - pagePad * 2);
  const nativeCardWidth =
    columns === 1 ? usableWidth : Math.floor((usableWidth - cardGap * (columns - 1)) / columns);
  const cardGridStyle =
    Platform.OS === "web"
      ? {
          display: "grid" as const,
          width: "100%" as const,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: cardGap,
          alignItems: "stretch" as const,
        }
      : { gap: cardGap };
  const cardSlotStyle: ViewStyle =
    Platform.OS === "web"
      ? { minWidth: 0, width: "100%", height: "100%" }
      : { width: nativeCardWidth, minWidth: 0, alignSelf: "stretch" };
  const searchWidthStyle = stackToolbar
    ? undefined
    : { width: Math.min(300, Math.max(180, Math.floor(width * 0.22))) };

  const openTrip = useCallback(
    (tripId: string) => {
      router.push(ROUTES.tripDetail(tripId) as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const openPay = useCallback((summary: ComplianceTripSummary) => {
    const readiness = deriveComplianceQueueReadiness(summary);
    if (!readiness.readyCategory) {
      alertMessage("Payment blocked", readiness.blockerLines[0] ?? "This trip is not ready for payment.");
      return;
    }
    setPay({ summary, category: readiness.readyCategory });
  }, []);

  const openDetails = useCallback(
    (tripId: string) => {
      router.push(ROUTES.complianceDetail(tripId) as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const reviewingSummaryFromList = useMemo(
    () => (review ? summaries.find((s) => s.trip.id === review.tripId) ?? null : null),
    [review, summaries],
  );
  const freshReview = useComplianceTripQuery(review?.tripId);
  const reviewingSummary = freshReview.data ?? reviewingSummaryFromList;

  if (orgCtx === undefined || accessLoading || productsLoading) {
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
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: layout.scrollBottomPadding(24),
          paddingHorizontal: pagePad,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.headerTop, isCompact && styles.headerTopStack]}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, isNarrow && styles.titleCompact]} numberOfLines={1}>
              Compliance Verification
            </Text>
          </View>
          <View style={[styles.headerActions, isCompact && styles.headerActionsStart]}>
            <View style={[styles.viewToggle, compactActions && styles.viewToggleCompact]}>
              <TouchableOpacity
                onPress={() => setViewMode("card")}
                style={[
                  styles.toggleBtn,
                  compactActions && styles.toggleBtnCompact,
                  viewMode === "card" && styles.toggleBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cards view"
                accessibilityState={{ selected: viewMode === "card" }}
              >
                <LayoutGrid
                  size={14}
                  color={viewMode === "card" ? Theme.buttonDarkText : Theme.textPrimary}
                  strokeWidth={2.2}
                />
                {!compactActions ? (
                  <Text style={[styles.toggleBtnText, viewMode === "card" && styles.toggleBtnTextActive]}>
                    Cards
                  </Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode("table")}
                style={[
                  styles.toggleBtn,
                  compactActions && styles.toggleBtnCompact,
                  viewMode === "table" && styles.toggleBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Table view"
                accessibilityState={{ selected: viewMode === "table" }}
              >
                <Table2
                  size={14}
                  color={viewMode === "table" ? Theme.buttonDarkText : Theme.textPrimary}
                  strokeWidth={2.2}
                />
                {!compactActions ? (
                  <Text style={[styles.toggleBtnText, viewMode === "table" && styles.toggleBtnTextActive]}>
                    Table
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
            {canViewFinance ? (
              <TouchableOpacity
                style={[styles.reportBtn, compactActions && styles.actionBtnCompact]}
                onPress={() => router.push(ROUTES.COMPLIANCE_REPORT as Parameters<typeof router.push>[0])}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Export Report"
              >
                <Download size={14} color={Theme.textPrimary} strokeWidth={2.2} />
                {!isNarrow ? (
                  <Text style={styles.reportBtnText}>{compactActions ? "Export" : "Export Report"}</Text>
                ) : null}
              </TouchableOpacity>
            ) : null}
            {canManageFinance ? (
              <TouchableOpacity
                style={[styles.bulkBtn, compactActions && styles.actionBtnCompact]}
                onPress={() => router.push(ROUTES.COMPLIANCE_BULK_PAYMENT as Parameters<typeof router.push>[0])}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Bulk Payment"
              >
                <Wallet size={14} color={Theme.complianceBulkText} strokeWidth={2.2} />
                {!isNarrow ? (
                  <Text style={styles.bulkBtnText}>{compactActions ? "Bulk" : "Bulk Payment"}</Text>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.toolbarRow, stackToolbar && styles.toolbarStack]}>
        <View
          style={[
            styles.searchRow,
            stackToolbar ? styles.searchRowStacked : searchWidthStyle,
            isNarrow && styles.searchRowNarrow,
          ]}
        >
          <Search size={15} color={Theme.textSecondary} strokeWidth={2.2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isNarrow ? "Search trips…" : "Search trip ID, vehicle, driver, or client"}
            placeholderTextColor={Theme.textSecondary}
            style={styles.searchInput as TextStyle}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            accessibilityLabel="Search compliance trips"
          />
        </View>
        <View style={styles.filtersRow}>
          <View style={[styles.chipWrap, isNarrow && styles.chipWrapNarrow]}>
            <StageChip
              label="All"
              count={counts.all}
              countColor={COMPLIANCE_FILTER_COUNT_TONE.all}
              active={stage === "all"}
              onPress={() => setStage("all")}
              compact={isNarrow}
            />
            {COMPLIANCE_STAGES.map((s) => (
              <StageChip
                key={s}
                label={COMPLIANCE_STAGE_FILTER_LABEL[s]}
                count={counts[s]}
                countColor={COMPLIANCE_FILTER_COUNT_TONE[s]}
                active={stage === s}
                onPress={() => setStage(s)}
                compact={isNarrow}
              />
            ))}
          </View>
        </View>
      </View>

      {isFetching && summaries.length > 0 ? (
        <Text style={styles.stale}>Updating queue…</Text>
      ) : null}

      {isLoading && summaries.length === 0 ? (
        <Text style={styles.message}>Loading required trip, document, and payment data…</Text>
      ) : isError ? (
        <View>
          <Text style={styles.message}>{(error as Error)?.message ?? "Couldn't load Compliance."}</Text>
          <TouchableOpacity style={styles.reportBtn} onPress={() => void refetch()}>
            <Text style={styles.reportBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredTotal === 0 ? (
        <Text style={styles.message}>
          {search.trim()
            ? "No trips match your search."
            : summaries.length
              ? "No trips in this stage."
              : "No Loading→Completed trips in the Compliance queue yet."}
        </Text>
      ) : viewMode === "table" ? (
        <ComplianceTripsTable
          summaries={visible}
          onOpenTrip={openTrip}
          onOpenDetails={openDetails}
          onReview={(tripId, documentKey, scope = "trip") => setReview({ tripId, documentKey, scope })}
          onMarkComplianceVerified={markTripVerified}
          onPay={(tripId) => {
            const summary = visible.find((s) => s.trip.id === tripId) ?? summaries.find((s) => s.trip.id === tripId);
            if (summary) openPay(summary);
          }}
          canManageFinance={canManageFinance}
        />
      ) : (
        <View style={[styles.cardGrid, cardGridStyle]}>
          {visible.map((summary) => (
            <View key={summary.trip.id} style={cardSlotStyle}>
              <ComplianceTripCard
                summary={summary}
                onReviewDocuments={(scope) => setReview({ tripId: summary.trip.id, documentKey: null, scope })}
                onViewTrip={() => openTrip(summary.trip.id)}
                onOpenDetails={() => openDetails(summary.trip.id)}
                onPay={() => openPay(summary)}
                onMarkComplianceVerified={() => markTripVerified(summary.trip.id)}
                canManageFinance={canManageFinance}
              />
            </View>
          ))}
        </View>
      )}

      {filteredTotal > pageSize ? (
        <View style={styles.pagerRow}>
          <TouchableOpacity
            style={[styles.pagerBtn, !hasPrev && styles.pagerBtnDisabled]}
            disabled={!hasPrev}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Text style={[styles.pagerBtnText, !hasPrev && styles.pagerBtnTextDisabled]}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.pagerMeta}>
            Page {page + 1} of {pageCount}
          </Text>
          <TouchableOpacity
            style={[styles.pagerBtn, !hasNext && styles.pagerBtnDisabled]}
            disabled={!hasNext}
            onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text style={[styles.pagerBtnText, !hasNext && styles.pagerBtnTextDisabled]}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {reviewingSummary ? (
        <ComplianceDocumentReviewSheet
          visible={review != null}
          onClose={() => setReview(null)}
          tripId={reviewingSummary.trip.id}
          tripLabel={`${reviewingSummary.trip.booking_ref ?? reviewingSummary.trip.id.slice(0, 8)} · ${reviewingSummary.trip.client_name || "Client"}`}
          organizationId={currentOrganization?.id ?? ""}
          actorId={user?.uid ?? null}
          documents={reviewingSummary.documents}
          canViewDocuments={canViewDocuments}
          canVerify={canVerifyDocuments}
          canMarkVerified={canMarkVerified}
          canManageFinance={canManageFinance}
          summary={reviewingSummary}
          initialSelectedKey={review?.documentKey ?? null}
          onChanged={() => invalidate(reviewingSummary.trip.id)}
          onPay={() => openPay(reviewingSummary)}
          scope={review?.scope ?? "trip"}
          vehicleId={reviewingSummary.trip.vehicle_id}
          driverId={reviewingSummary.trip.driver_id}
          vehicleDocuments={reviewingSummary.vehicleDocuments ?? []}
          driverDocuments={reviewingSummary.driverDocuments ?? []}
          vehicleLabel={reviewingSummary.trip.vehicle_display_number?.trim() || "Unassigned"}
          driverLabel={reviewingSummary.trip.driver_display_name?.trim() || "Unassigned"}
        />
      ) : null}

      <CompliancePaymentConfirmModal
        visible={pay != null}
        summary={pay?.summary ?? null}
        category={pay?.category ?? null}
        submitting={paying}
        onCancel={() => {
          if (!paying) setPay(null);
        }}
        onConfirm={async (values) => {
          if (!pay || !currentOrganization?.id) return;
          setPaying(true);
          const { error: payError } = await postCompliancePayment({
            organizationId: currentOrganization.id,
            trip: pay.summary.trip,
            category: pay.category,
            amount: values.amount,
            paymentModeId: values.paymentModeId,
            paymentModeLabel: values.paymentModeLabel,
            utr: values.utr,
          });
          setPaying(false);
          if (payError) {
            alertMessage("Couldn't post payment", payError.message);
            return;
          }
          setPay(null);
          invalidate(pay.summary.trip.id);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.compliancePageBg },
  content: { paddingTop: Layout.spacingMedium, gap: Layout.spacingMedium },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Theme.compliancePageBg },
  header: { gap: 14 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerTopStack: { flexDirection: "column", alignItems: "stretch" },
  titleBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  titleCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  headerActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  headerActionsStart: { justifyContent: "flex-start" },
  searchRow: {
    flexShrink: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
  },
  searchRowStacked: {
    width: "100%",
    maxWidth: "100%",
  },
  searchRowNarrow: {
    height: 34,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 36,
    paddingVertical: 0,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimary,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as const } : null),
  },
  bulkBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Theme.complianceBulk,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reportBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnCompact: {
    paddingHorizontal: 10,
    minWidth: 36,
  },
  bulkBtnText: { fontSize: 13, fontWeight: "700", color: Theme.complianceBulkText },
  reportBtnText: { fontSize: 13, fontWeight: "600", color: Theme.textPrimary },
  toolbarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  toolbarStack: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  filtersRow: {
    flex: 1,
    minWidth: 0,
    width: "100%",
  },
  chipWrap: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chipWrapNarrow: {
    gap: 6,
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  chipCompact: {
    height: 32,
    paddingHorizontal: 10,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: Theme.textPrimary, lineHeight: 16 },
  chipTextCompact: { fontSize: 12, lineHeight: 15 },
  chipTextActive: { color: Theme.buttonDarkText },
  chipCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountBadgeCompact: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
  },
  chipCount: { fontSize: 11, fontWeight: "800", lineHeight: 14 },
  chipCountCompact: { fontSize: 10, lineHeight: 12 },
  viewToggle: {
    flexShrink: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    gap: 2,
  },
  viewToggleCompact: {
    height: 34,
  },
  toggleBtn: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  toggleBtnCompact: {
    width: 32,
    height: 28,
    paddingHorizontal: 0,
  },
  toggleBtnActive: { backgroundColor: Theme.buttonDark },
  toggleBtnText: { fontSize: 13, fontWeight: "600", color: Theme.textPrimary, lineHeight: 16 },
  toggleBtnTextActive: { color: Theme.buttonDarkText },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  message: { fontSize: 14, color: Theme.textSecondary, textAlign: "center", paddingVertical: 28, lineHeight: 20 },
  stale: { fontSize: 12, color: Theme.textSecondary },
  pagerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  pagerBtn: {
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerBtnText: { fontSize: 13, fontWeight: "700", color: Theme.textPrimary },
  pagerBtnTextDisabled: { color: Theme.textMuted },
  pagerMeta: { fontSize: 12, fontWeight: "600", color: Theme.textMuted },
});
