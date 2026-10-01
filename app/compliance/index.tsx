/**
 * Global Compliance Verification work queue — header, counted stage filters,
 * Cards/Table toggle, and Trip/Vehicle/Driver checklist cards.
 */
import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import { HubPromoHeroLottie } from "@/components/hub/HubPromoLottie";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import { ComplianceDocumentReviewSheet } from "@/features/tripCompliance/components/ComplianceDocumentReviewSheet";
import { ComplianceExportConfirmModal } from "@/features/tripCompliance/components/ComplianceExportConfirmModal";
import { CompliancePaymentConfirmModal } from "@/features/tripCompliance/components/CompliancePaymentConfirmModal";
import { ComplianceDocumentWorkspace } from "@/features/tripCompliance/components/ComplianceDocumentWorkspace";
import { ComplianceTripsTable } from "@/features/tripCompliance/components/ComplianceTripsTable";
import { useComplianceProductEnabled } from "@/features/tripCompliance/hooks/useComplianceProductEnabled";
import { useComplianceListTripFacts } from "@/features/tripCompliance/hooks/useComplianceListTripFacts";
import {
  COMPLIANCE_QUEUE_PAGE_SIZE,
  useComplianceListPagination,
  useComplianceStageFilter,
  useComplianceTripsQuery,
  useComplianceTripQuery,
  useComplianceChangeSync,
} from "@/features/tripCompliance/hooks/useComplianceTripsQuery";
import {
  declineTripCompliance,
  rejectTripCompliance,
  postCompliancePayment,
  markTripComplianceVerified,
  type ComplianceLedgerCategory,
} from "@/features/tripCompliance/services/tripComplianceWrite.service";
import { COMPLIANCE_STAGE_FILTER_LABEL, COMPLIANCE_STAGES, type ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import {
  COMPLIANCE_FILTER_COUNT_TONE,
  matchesComplianceTripSearch,
  supplierComplianceSearchLabels,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import {
  countVerifiedStageDocuments,
} from "@/features/tripCompliance/utils/complianceExportReport.util";
import { exportVerifiedStageComplianceReport } from "@/features/tripCompliance/services/complianceExportReport.service";
import { deriveComplianceQueueReadiness } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { formatMarkComplianceVerifiedError } from "@/features/tripCompliance/utils/complianceMarkVerifiedError.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import { EMPTY_STATE_LOTTIE } from "@/lib/emptyStateLottieAssets";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { useSuppliersQuery } from "@/lib/queries/useSuppliersQuery";
import { ROUTES } from "@/lib/routes";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { useRouter } from "expo-router";
import { Download, LayoutGrid, Search, Table2, Wallet } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, type TextStyle } from "react-native";

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
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count > 0 ? (
        <View
          style={[
            styles.chipCountBadge,
            { backgroundColor: active ? Theme.buttonDarkText : countColor },
          ]}
        >
          <Text
            style={[
              styles.chipCount,
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

/** Window in which a retried Decline submit reuses its idempotency key. */
const DECLINE_KEY_REUSE_MS = 2 * 60 * 1000;

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
  const canManagePod = canSurface("trip_compliance.pod.manage");
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
  const { stage, setStage, filtered, counts, podReceivedCount, paymentPendingCount } = useComplianceStageFilter(summaries);
  const suppliersQuery = useSuppliersQuery(currentOrganization?.id ?? null);
  const supplierSearchById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const supplier of suppliersQuery.data ?? []) {
      const labels = supplierComplianceSearchLabels(supplier);
      if (labels) map[supplier.id] = labels;
    }
    return map;
  }, [suppliersQuery.data]);
  // Resolve labels for the full queue so supplier search works across stage chips.
  const { supplierNameByTripId } = useComplianceListTripFacts(
    summaries,
    currentOrganization?.id ?? "",
  );
  const syncChange = useComplianceChangeSync();
  const markTripVerified = useCallback(
    async (tripId: string) => {
      if (!canMarkVerified) {
        alertMessage("Can't verify", "You don't have permission to mark this trip compliance verified.");
        return false;
      }
      if (!user?.uid) {
        alertMessage("Can't verify", "Sign in again, then try Verify Docs.");
        return false;
      }
      const { error } = await markTripComplianceVerified({ tripId, actorId: user.uid });
      if (error) {
        alertMessage("Couldn't verify compliance", formatMarkComplianceVerifiedError(error.message));
        return false;
      }
      await syncChange({ type: "complianceVerified", tripId, actorId: user.uid });
      return true;
    },
    [canMarkVerified, syncChange, user?.uid],
  );
  /**
   * One idempotency key per (trip, reason) submit, kept until success so a quick
   * retry after a network failure is deduped server-side. A different reason, or a
   * retry after DECLINE_KEY_REUSE_MS, gets a new key (so a later re-decline with the
   * same text is never silently skipped).
   */
  const declineKeysRef = useRef(new Map<string, { reason: string; key: string; at: number }>());
  const declineTrip = useCallback(
    async (tripId: string, reason: string) => {
      if (!canMarkVerified) {
        throw new Error("You don't have permission to decline compliance for this trip.");
      }
      if (!user?.uid) {
        throw new Error("Sign in again, then try Decline.");
      }
      const trimmed = reason.trim();
      const keys = declineKeysRef.current;
      const now = Date.now();
      let entry = keys.get(tripId);
      if (!entry || entry.reason !== trimmed || now - entry.at > DECLINE_KEY_REUSE_MS) {
        entry = { reason: trimmed, key: `${tripId}:${now}:${Math.random().toString(36).slice(2, 10)}`, at: now };
        keys.set(tripId, entry);
      }
      try {
        await declineTripCompliance({ tripId, reason: trimmed, idempotencyKey: entry.key });
      } catch (error) {
        // e.g. someone else verified it meanwhile — refresh this trip's flags so the
        // row catches up, then let the modal show the (user-facing) error.
        void syncChange({ type: "tripFlags", tripId }).catch(() => undefined);
        throw error;
      }
      keys.delete(tripId);
      await syncChange({ type: "complianceDeclined", tripId, actorId: user.uid, reason: trimmed });
      // Defer so the modal can close first (web alert blocks).
      setTimeout(() => alertMessage("Compliance declined", "The trip stays in Compliance Pending with your reason recorded."), 0);
    },
    [canMarkVerified, syncChange, user?.uid],
  );

  const rejectKeysRef = useRef(new Map<string, { reason: string; key: string; at: number }>());
  const rejectTrip = useCallback(
    async (tripId: string, reason: string) => {
      if (!canMarkVerified) {
        throw new Error("You don't have permission to reject compliance for this trip.");
      }
      if (!user?.uid) {
        throw new Error("Sign in again, then try Reject.");
      }
      const trimmed = reason.trim();
      const keys = rejectKeysRef.current;
      const now = Date.now();
      let entry = keys.get(tripId);
      if (!entry || entry.reason !== trimmed || now - entry.at > DECLINE_KEY_REUSE_MS) {
        entry = { reason: trimmed, key: `${tripId}:rej:${now}:${Math.random().toString(36).slice(2, 10)}`, at: now };
        keys.set(tripId, entry);
      }
      try {
        await rejectTripCompliance({ tripId, reason: trimmed, idempotencyKey: entry.key });
      } catch (error) {
        void syncChange({ type: "tripFlags", tripId }).catch(() => undefined);
        throw error;
      }
      keys.delete(tripId);
      await syncChange({ type: "complianceDeclined", tripId, actorId: user.uid, reason: trimmed });
      setTimeout(
        () =>
          alertMessage(
            "Trip rejected",
            "The trip stays under Verified with a Rejected status. Advance payment is blocked until resolved.",
          ),
        0,
      );
    },
    [canMarkVerified, syncChange, user?.uid],
  );

  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  // Selected trip in the Cards workspace; Table Verify (not ready) hands off here.
  const [cardTripId, setCardTripId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pay, setPay] = useState<{ summary: ComplianceTripSummary; category: ComplianceLedgerCategory } | null>(null);
  const [paying, setPaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [review, setReview] = useState<{
    tripId: string;
    documentKey: string | null;
    scope: "trip" | "vehicle" | "driver";
  } | null>(null);

  const searched = useMemo(() => {
    // With an active query, search the full Compliance queue (not only the
    // selected stage chip) so supplier / trip matches aren't hidden by filter.
    const pool = search.trim() ? summaries : filtered;
    return pool.filter((summary) => {
      const supplierId = (summary.trip.supplier_id ?? "").trim();
      const resolved = supplierNameByTripId[summary.trip.id];
      return matchesComplianceTripSearch(summary, search, [
        supplierId ? supplierSearchById[supplierId] : null,
        resolved && resolved !== "—" ? resolved : null,
      ]);
    });
  }, [filtered, summaries, search, supplierSearchById, supplierNameByTripId]);
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
  /** Responsive breakpoints for header and toolbar (Payment Pending chip). */
  const isNarrow = width < 560;
  const stackToolbar = width < 980;
  const compactActions = width < 700;
  const searchWidthStyle = stackToolbar
    ? undefined
    : { width: Math.min(220, Math.max(160, Math.floor(width * 0.16))) };

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

  const verifiedExportDocumentCount = useMemo(
    () => countVerifiedStageDocuments(summaries),
    [summaries],
  );

  const confirmExportReport = useCallback(async () => {
    if (!currentOrganization?.id || exporting) return;
    setExporting(true);
    try {
      const exported = await exportVerifiedStageComplianceReport(currentOrganization.id);
      setExportOpen(false);
      if (exported === 0) {
        alertMessage("Nothing to export", "No verified-stage trips are ready to download yet.");
      }
    } catch (error) {
      alertMessage("Couldn't export report", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setExporting(false);
    }
  }, [currentOrganization?.id, exporting]);

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
          <Search size={12} color={Theme.textSecondary} strokeWidth={2} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isNarrow ? "Search trips…" : "Search trip ID, vehicle, driver, client, or supplier"}
            placeholderTextColor={Theme.textSecondary}
            style={styles.searchInput as TextStyle}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            accessibilityLabel="Search compliance trips"
          />
        </View>
        <View style={styles.filtersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipWrap}
            keyboardShouldPersistTaps="handled"
          >
            <StageChip
              label="All"
              count={counts.all}
              countColor={COMPLIANCE_FILTER_COUNT_TONE.all}
              active={stage === "all"}
              onPress={() => setStage("all")}
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
                />
              );
              if (s === "advance_payment_processed") {
                return [
                  chip,
                  <StageChip
                    key="payment_pending"
                    label="Payment Pending"
                    count={paymentPendingCount}
                    countColor={Theme.complianceStageBalanceFg}
                    active={stage === "payment_pending"}
                    onPress={() => setStage("payment_pending")}
                  />,
                ];
              }
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
                />,
              ];
            })}
          </ScrollView>
        </View>
      </View>
      </View>

      <View style={styles.queueBody}>
      {isFetching && summaries.length > 0 ? (
        <Text style={styles.stale}>Updating queue…</Text>
      ) : null}

      {isLoading && summaries.length === 0 ? (
        <View style={styles.emptyFill}>
          <Text style={styles.message}>Loading required trip, document, and payment data…</Text>
        </View>
      ) : isError ? (
        <View style={styles.emptyFill}>
          <Text style={styles.message}>{(error as Error)?.message ?? "Couldn't load Compliance."}</Text>
          <TouchableOpacity style={styles.reportBtn} onPress={() => void refetch()}>
            <Text style={styles.reportBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === "table" && filteredTotal === 0 ? (
        <View style={styles.emptyFill}>
          <HubPromoHeroLottie
            source={EMPTY_STATE_LOTTIE.tripsTable}
            width={isNarrow ? 200 : 260}
            height={isNarrow ? 160 : 200}
          />
          <Text style={styles.emptyCaption}>
            {search.trim()
              ? "No trips match your search."
              : summaries.length
                ? stage === "payment_pending"
                  ? "No trips are waiting for advance payment."
                  : "No trips in this stage."
                : "No Loading→Completed trips in the Compliance queue yet."}
          </Text>
        </View>
      ) : viewMode === "table" ? (
        <ScrollView style={styles.queueScroll} contentContainerStyle={styles.queueScrollContent} keyboardShouldPersistTaps="handled">
          <ComplianceTripsTable
            summaries={visible}
            onOpenTrip={openTrip}
            onOpenDetails={openDetails}
            onReview={(tripId, documentKey, scope = "trip") => setReview({ tripId, documentKey, scope })}
            onMarkComplianceVerified={canMarkVerified ? markTripVerified : undefined}
            onVerifyDocs={(tripId) => {
              setCardTripId(tripId);
              setViewMode("card");
            }}
            onDeclineCompliance={canMarkVerified ? declineTrip : undefined}
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
          paymentSubmitting={paying}
          onConfirmPayment={
            canManageFinance
              ? async (summary, category, values) => {
                  if (!currentOrganization?.id) return;
                  setPaying(true);
                  const { error: payError } = await postCompliancePayment({
                    organizationId: currentOrganization.id,
                    trip: summary.trip,
                    category,
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
                  void syncChange({ type: "payment", tripId: summary.trip.id });
                }
              : undefined
          }
          onRejectCompliance={canMarkVerified ? rejectTrip : undefined}
          onMarkComplianceVerified={canMarkVerified ? markTripVerified : undefined}
          canManagePod={canManagePod}
          selectedTripId={cardTripId}
          stacked={isNarrow}
          onChanged={(change) => void syncChange(change)}
          onReviewTripDocs={(tripId, documentKey, scope = "trip") => {
            setCardTripId(tripId);
            setReview({ tripId, documentKey, scope });
          }}
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
              onPress={() => setExportOpen(true)}
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
          onChanged={(changed) => {
            const trip = reviewingSummary.trip;
            const scope = review?.scope ?? "trip";
            const vehicleId = trip.vehicle_id ?? trip.owner_vehicle_id;
            if (changed === "flags") void syncChange({ type: "tripFlags", tripId: trip.id });
            else if (scope === "vehicle" && vehicleId) void syncChange({ type: "vehicleDocuments", vehicleId });
            else if (scope === "driver" && trip.driver_id) void syncChange({ type: "driverDocuments", driverId: trip.driver_id });
            else void syncChange({ type: "tripDocuments", tripId: trip.id });
          }}
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

      <ComplianceExportConfirmModal
        visible={exportOpen}
        documentCount={verifiedExportDocumentCount}
        exporting={exporting}
        onCancel={() => {
          if (!exporting) setExportOpen(false);
        }}
        onConfirm={() => {
          void confirmExportReport();
        }}
      />

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
          void syncChange({ type: "payment", tripId: pay.summary.trip.id });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, overflow: "hidden", backgroundColor: Theme.compliancePageBg },
  chrome: { flexShrink: 0, paddingTop: 8 },
  queueBody: { flex: 1, minHeight: 0, marginTop: 8, gap: 4 },
  queueScroll: { flex: 1, width: "100%", minWidth: 0 },
  queueScrollContent: { paddingBottom: 8, width: "100%", minWidth: 0 },
  workspaceFill: { flex: 1, minHeight: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Theme.compliancePageBg },
  searchRow: {
    flexShrink: 0,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
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
    height: 24,
    paddingHorizontal: 7,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingVertical: 0,
    fontSize: 11,
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
  },
  chipScroll: {
    flexGrow: 0,
    width: "100%",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 4,
    paddingRight: 2,
  },
  chip: {
    flexShrink: 0,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chipActive: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  chipText: { fontSize: 11, fontWeight: "500", color: Theme.textPrimary, lineHeight: 13 },
  chipTextActive: { color: Theme.buttonDarkText, fontWeight: "600" },
  chipCountBadge: {
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCount: { fontSize: 9, fontWeight: "600", lineHeight: 11, textAlign: "center" },
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
  emptyFill: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 4,
  },
  emptyCaption: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    color: Theme.textPrimary,
    textAlign: "center",
  },
  message: { fontSize: 14, color: Theme.textSecondary, textAlign: "center", lineHeight: 20 },
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
