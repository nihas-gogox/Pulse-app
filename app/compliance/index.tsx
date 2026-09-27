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
import { ComplianceDocumentWorkspace } from "@/features/tripCompliance/components/ComplianceDocumentWorkspace";
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
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, type TextStyle } from "react-native";

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
  const { width, height: windowHeight } = useWindowDimensions();
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
  const { stage, setStage, filtered, counts, podReceivedCount } = useComplianceStageFilter(summaries);
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
  const stackToolbar = width < 980;
  const compactActions = width < 700;
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
    <View
      style={[
        styles.screen,
        {
          paddingTop: contentTopInset,
          paddingBottom: layout.scrollBottomPadding(4),
          paddingHorizontal: pagePad,
          maxHeight: windowHeight,
        },
      ]}
    >
      <View style={styles.chrome}>
      <View style={[styles.toolbarRow, stackToolbar && styles.toolbarStack]}>
        <View
          style={[
            styles.searchRow,
            stackToolbar ? styles.searchRowStacked : searchWidthStyle,
            isNarrow && styles.searchRowNarrow,
          ]}
        >
          <Search size={13} color={Theme.textSecondary} strokeWidth={2} />
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
            {COMPLIANCE_STAGES.flatMap((s) => {
              const chip = (
                <StageChip
                  key={s}
                  label={COMPLIANCE_STAGE_FILTER_LABEL[s]}
                  count={counts[s]}
                  countColor={COMPLIANCE_FILTER_COUNT_TONE[s]}
                  active={stage === s}
                  onPress={() => setStage(s)}
                  compact={isNarrow}
                />
              );
              if (s !== "hard_copy_pod_received") return [chip];
              return [
                chip,
                <StageChip
                  key="pod_received"
                  label="POD Received"
                  count={podReceivedCount}
                  countColor={Theme.complianceStageSuccessFg}
                  active={stage === "pod_received"}
                  onPress={() => setStage("pod_received")}
                  compact={isNarrow}
                />,
              ];
            })}
          </View>
        </View>
      </View>
      </View>

      <View style={styles.queueBody}>
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
        <ScrollView style={styles.queueScroll} contentContainerStyle={styles.queueScrollContent} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      ) : (
        <ComplianceDocumentWorkspace
          style={styles.workspaceFill}
          summaries={visible}
          organizationId={currentOrganization?.id ?? ""}
          actorId={user?.uid ?? null}
          canVerify={canVerifyDocuments}
          canViewDocuments={canViewDocuments}
          canManageFinance={canManageFinance}
          onPay={openPay}
          stacked={isNarrow}
          onChanged={(tripId) => invalidate(tripId)}
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerSide}>
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
                size={13}
                color={viewMode === "card" ? Theme.buttonDarkText : Theme.textPrimary}
                strokeWidth={2}
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
                size={13}
                color={viewMode === "table" ? Theme.buttonDarkText : Theme.textPrimary}
                strokeWidth={2}
              />
              {!compactActions ? (
                <Text style={[styles.toggleBtnText, viewMode === "table" && styles.toggleBtnTextActive]}>
                  Table
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
        {filteredTotal > pageSize ? (
          <View style={styles.pagerRow}>
            <TouchableOpacity
              style={[styles.pagerBtn, !hasPrev && styles.pagerBtnDisabled]}
              disabled={!hasPrev}
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Next page"
            >
              <Text style={[styles.pagerBtnText, !hasNext && styles.pagerBtnTextDisabled]}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footerCenter} />
        )}
        <View style={[styles.footerSide, styles.footerSideEnd]}>
          {canViewFinance ? (
            <TouchableOpacity
              style={[styles.reportBtn, compactActions && styles.actionBtnCompact]}
              onPress={() => router.push(ROUTES.COMPLIANCE_REPORT as Parameters<typeof router.push>[0])}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Export Report"
            >
              <Download size={13} color={Theme.textPrimary} strokeWidth={2} />
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
              <Wallet size={13} color={Theme.complianceBulkText} strokeWidth={2} />
              {!isNarrow ? (
                <Text style={styles.bulkBtnText}>{compactActions ? "Bulk" : "Bulk Payment"}</Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      </View>

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
            notes: values.remark,
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, overflow: "hidden", backgroundColor: Theme.compliancePageBg },
  chrome: { flexShrink: 0, paddingTop: 8 },
  queueBody: { flex: 1, minHeight: 0, marginTop: 8, gap: 4 },
  queueScroll: { flex: 1 },
  queueScrollContent: { paddingBottom: 8 },
  workspaceFill: { flex: 1, minHeight: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Theme.compliancePageBg },
  searchRow: {
    flexShrink: 0,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
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
    height: 28,
    paddingHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingVertical: 0,
    fontSize: 12,
    fontWeight: "400",
    color: Theme.textPrimary,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as const } : null),
  },
  bulkBtn: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Theme.complianceBulk,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reportBtn: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnCompact: {
    paddingHorizontal: 10,
    minWidth: 36,
  },
  bulkBtnText: { fontSize: 11, fontWeight: "600", lineHeight: 14, color: Theme.complianceBulkText },
  reportBtnText: { fontSize: 11, fontWeight: "500", lineHeight: 14, color: Theme.textPrimary },
  toolbarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    alignContent: "flex-start",
    gap: 6,
  },
  chipWrapNarrow: {
    gap: 4,
  },
  chip: {
    flexShrink: 0,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chipCompact: {
    height: 26,
    paddingHorizontal: 8,
    gap: 4,
  },
  chipActive: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  chipText: { fontSize: 12, fontWeight: "500", color: Theme.textPrimary, lineHeight: 14 },
  chipTextCompact: { fontSize: 11, lineHeight: 13 },
  chipTextActive: { color: Theme.buttonDarkText, fontWeight: "600" },
  chipCountBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountBadgeCompact: {
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
  },
  chipCount: { fontSize: 9, fontWeight: "600", lineHeight: 11, textAlign: "center" },
  chipCountCompact: { fontSize: 8, lineHeight: 10 },
  viewToggle: {
    flexShrink: 0,
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    borderRadius: 999,
    padding: 2,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    gap: 2,
  },
  viewToggleCompact: {
    height: 26,
  },
  toggleBtn: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  toggleBtnCompact: {
    width: 28,
    height: 22,
    paddingHorizontal: 0,
  },
  toggleBtnActive: { backgroundColor: Theme.buttonDark },
  toggleBtnText: { fontSize: 11, fontWeight: "500", color: Theme.textPrimary, lineHeight: 14 },
  toggleBtnTextActive: { color: Theme.buttonDarkText, fontWeight: "600" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  message: { fontSize: 14, color: Theme.textSecondary, textAlign: "center", paddingVertical: 28, lineHeight: 20 },
  stale: { fontSize: 12, color: Theme.textSecondary },
  footer: {
    flexShrink: 0,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerSide: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerSideEnd: { justifyContent: "flex-end" },
  footerCenter: { width: 160 },
  pagerRow: {
    flexShrink: 0,
    width: 200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pagerBtn: {
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerBtnText: { fontSize: 11, fontWeight: "500", lineHeight: 14, color: Theme.textPrimary },
  pagerBtnTextDisabled: { color: Theme.textMuted },
  pagerMeta: { fontSize: 11, fontWeight: "500", lineHeight: 14, color: Theme.textMuted },
});
