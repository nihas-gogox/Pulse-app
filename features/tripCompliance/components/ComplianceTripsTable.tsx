/**
 * Table workbench for the Compliance workbench — trip is the primary row,
 * expandable to reveal its documents inline. Same already-fetched
 * `ComplianceTripSummary[]`, no extra query. Trip/Vehicle/Driver cells show a
 * single Pending/Approved status that opens the same
 * ComplianceDocumentReviewSheet used by the card view (no duplicate
 * approve/reject wiring). E-way Bill column + Verify/Decline actions per
 * docs/compliance/dinesh/CONTRACT.md.
 */
import Theme from "@/constants/Theme";
import { ComplianceDeclineModal } from "@/features/tripCompliance/components/ComplianceDeclineModal";
import { COMPLIANCE_STATUS_META, ComplianceStatusChip } from "@/features/tripCompliance/components/ComplianceStatusIcon";
import {
  COMPLIANCE_DECLINE_ACTION_LABEL,
  HIGHLIGHT_EXPIRED_EWAY_BILL,
} from "@/features/tripCompliance/complianceDecisionConfig";
import {
  REQUIRED_DRIVER_DOCUMENT_TYPES,
  REQUIRED_VEHICLE_DOCUMENT_TYPES,
  type ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  complianceEventAt,
  formatComplianceTimestamp,
  paymentStatusVisual,
  shouldShowPaymentStatusPill,
  verificationStatusVisual,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import {
  deriveComplianceDocumentRows,
  deriveEntityComplianceRows,
  labelForDocType,
  requirementScopeLabel,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import { deriveComplianceQueueReadiness, paymentReadinessLabel } from "@/features/tripCompliance/utils/complianceReadiness.util";
import {
  canVerifyTrip,
  deriveComplianceEwayBill,
  deriveComplianceGroupStatus,
  isComplianceDeclineActive,
} from "@/features/tripCompliance/utils/complianceTableStatus.util";
import { getTripDisplayNumber } from "@/features/trips/services/trips.service";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ComplianceTripsTableProps = {
  summaries: ComplianceTripSummary[];
  onOpenTrip: (tripId: string) => void;
  onOpenDetails?: (tripId: string) => void;
  /** Opens the review sheet; documentKey null opens straight to the document list. */
  onReview: (tripId: string, documentKey: string | null, scope?: "trip" | "vehicle" | "driver") => void;
  /** Verify action; runs once LR, E-way Bill and Invoice are approved, otherwise opens the trip documents. Resolves; the page shows errors. */
  onMarkComplianceVerified?: (tripId: string) => Promise<void>;
  /** Decline action; rejects with an Error whose message is user-facing (shown in the modal). */
  onDeclineCompliance?: (tripId: string, reason: string) => Promise<void>;
  onPay?: (tripId: string) => void;
  canManageFinance?: boolean;
};

type RequiredDateSort = "asc" | "desc";

function tripFromLocation(summary: ComplianceTripSummary): string {
  return summary.trip.pickup_area?.trim() || "—";
}

function tripToLocation(summary: ComplianceTripSummary): string {
  return summary.trip.drop_location?.trim() || summary.trip.drop_area?.trim() || "—";
}

function formatRequiredDate(summary: ComplianceTripSummary): string {
  const raw = complianceEventAt(summary.trip);
  if (!raw) return "—";
  const formatted = formatComplianceTimestamp(raw);
  return formatted || "—";
}

function requiredDateSortKey(summary: ComplianceTripSummary): number | null {
  const raw = complianceEventAt(summary.trip);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

type DocScope = "trip" | "vehicle" | "driver";

const SCOPE_LABEL: Record<DocScope, string> = {
  trip: "Trip",
  vehicle: "Vehicle",
  driver: "Driver",
};

function GroupStatusPill({
  tripId,
  scope,
  rows,
  onPress,
}: {
  tripId: string;
  scope: DocScope;
  rows: ComplianceDocRow[];
  onPress: () => void;
}) {
  const group = deriveComplianceGroupStatus(rows);
  const approved = group.status === "approved";
  const label = approved ? "Approved" : "Pending";
  return (
    <TouchableOpacity
      testID={`compliance-status-${scope}-${tripId}`}
      style={styles.statusTouch}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${SCOPE_LABEL[scope]} documents ${label}, ${group.approved} of ${group.total} approved. Open verification`}
    >
      <View style={[styles.statusPill, approved ? styles.statusPillApproved : styles.statusPillPending]}>
        <Text style={[styles.statusPillText, approved ? styles.successText : styles.dangerText]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function EwayBillCell({ summary }: { summary: ComplianceTripSummary }) {
  const eway = useMemo(() => deriveComplianceEwayBill(summary.documents), [summary.documents]);
  const tripId = summary.trip.id;
  if (!eway.number && !eway.validTillLabel) {
    return (
      <View style={styles.colEway} testID={`compliance-eway-${tripId}`}>
        <Text style={styles.cell}>—</Text>
      </View>
    );
  }
  const showExpired = HIGHLIGHT_EXPIRED_EWAY_BILL && eway.expired;
  return (
    <View
      style={styles.colEway}
      testID={`compliance-eway-${tripId}`}
      accessibilityLabel={`E-way Bill ${eway.number ?? "—"}, valid till ${eway.validTillLabel ?? "—"}${
        showExpired ? ", expired" : ""
      }${eway.extraCount > 0 ? `, ${eway.extraCount} more` : ""}`}
    >
      <View style={styles.ewayLine}>
        <Text style={[styles.cell, styles.ewayNumber]} numberOfLines={1} selectable>
          {eway.number ?? "—"}
        </Text>
        {eway.extraCount > 0 ? <Text style={styles.muted}>{`+${eway.extraCount}`}</Text> : null}
      </View>
      <View style={styles.ewayLine}>
        <Text style={[styles.muted, styles.ewayDate, showExpired && styles.dangerText]} numberOfLines={1}>
          {`Valid till ${eway.validTillLabel ?? "—"}`}
        </Text>
        {showExpired ? (
          <View style={[styles.miniPill, styles.statusPillPending]}>
            <Text style={[styles.miniPillText, styles.dangerText]}>Expired</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SortHeader({
  label,
  sort,
  onToggle,
  style,
}: {
  label: string;
  sort: RequiredDateSort;
  onToggle: () => void;
  style?: object;
}) {
  const Icon = sort === "asc" ? ArrowUp : ArrowDown;
  return (
    <TouchableOpacity
      style={[styles.colRequiredDate, style]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}, currently ${sort === "asc" ? "ascending" : "descending"}`}
    >
      <Text style={[styles.cell, styles.headerText]}>{label}</Text>
      <Icon size={12} color={Theme.textPrimary} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

function TripRowContent({
  summary,
  onOpenTrip,
  onOpenDetails,
  onReview,
  onMarkComplianceVerified,
  onDeclineCompliance,
  onPay,
  canManageFinance = false,
}: {
  summary: ComplianceTripSummary;
  onOpenTrip: (tripId: string) => void;
  onOpenDetails?: (tripId: string) => void;
  onReview: (tripId: string, documentKey: string | null, scope?: "trip" | "vehicle" | "driver") => void;
  onMarkComplianceVerified?: (tripId: string) => Promise<void>;
  onDeclineCompliance?: (tripId: string, reason: string) => Promise<void>;
  onPay?: (tripId: string) => void;
  canManageFinance?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [markingTrip, setMarkingTrip] = useState(false);
  const markingRef = useRef(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const rows = useMemo(() => deriveComplianceDocumentRows(summary.documents), [summary.documents]);
  const vehicleRows = useMemo(
    () =>
      deriveEntityComplianceRows(REQUIRED_VEHICLE_DOCUMENT_TYPES, summary.vehicleDocuments).filter((row) => row.required),
    [summary.vehicleDocuments],
  );
  const driverRows = useMemo(
    () =>
      deriveEntityComplianceRows(REQUIRED_DRIVER_DOCUMENT_TYPES, summary.driverDocuments).filter((row) => row.required),
    [summary.driverDocuments],
  );
  const tripMandatoryRows = useMemo(() => rows.filter((row) => row.required), [rows]);
  const readiness = useMemo(() => deriveComplianceQueueReadiness(summary), [summary]);
  const payLabel = paymentReadinessLabel(readiness);
  const verification = verificationStatusVisual(summary);
  const payment = paymentStatusVisual(summary);
  const showPaymentPill = shouldShowPaymentStatusPill(summary);
  const tripIdLabel = getTripDisplayNumber(summary.trip);
  const tripId = summary.trip.id;
  const isVerified = Boolean(summary.complianceVerifiedAt);
  const verifyEligibility = useMemo(() => canVerifyTrip(summary), [summary]);
  const declineActive = isComplianceDeclineActive(summary);
  const declineReason = summary.complianceDeclineReason?.trim() || "";

  const handleVerify = () => {
    if (markingRef.current || !onMarkComplianceVerified) return;
    if (!verifyEligibility.allowed) {
      // Not ready: open the trip documents to approve (as V1's "Verify Docs" did).
      onReview(tripId, null, "trip");
      return;
    }
    markingRef.current = true;
    setMarkingTrip(true);
    void onMarkComplianceVerified(tripId).finally(() => {
      markingRef.current = false;
      setMarkingTrip(false);
    });
  };

  const handleDeclineSubmit = async (reason: string) => {
    if (!onDeclineCompliance) return;
    await onDeclineCompliance(tripId, reason);
    setDeclineOpen(false);
  };

  const verifyDisabled = markingTrip;

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.expandToggle}>
          {expanded ? (
            <ChevronDown size={14} color={Theme.textMuted} strokeWidth={2.2} />
          ) : (
            <ChevronRight size={14} color={Theme.textMuted} strokeWidth={2.2} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.colTripId}
          onPress={() => (onOpenDetails ?? onOpenTrip)(summary.trip.id)}
        >
          <Text style={styles.cell} selectable numberOfLines={1}>
            {tripIdLabel}
          </Text>
          <Text style={[styles.cell, styles.muted]} numberOfLines={1}>
            {summary.trip.client_name || "—"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.cell, styles.colDate]} numberOfLines={1}>
          {formatRequiredDate(summary)}
        </Text>
        <Text style={[styles.cell, styles.colLoc]} numberOfLines={1}>
          {tripFromLocation(summary)}
        </Text>
        <Text style={[styles.cell, styles.colLoc]} numberOfLines={1}>
          {tripToLocation(summary)}
        </Text>
        <EwayBillCell summary={summary} />
        <View style={styles.colDocs}>
          <GroupStatusPill
            tripId={tripId}
            scope="trip"
            rows={tripMandatoryRows}
            onPress={() => onReview(tripId, null, "trip")}
          />
        </View>
        <View style={styles.colDocs}>
          <GroupStatusPill
            tripId={tripId}
            scope="vehicle"
            rows={vehicleRows}
            onPress={() => onReview(tripId, null, "vehicle")}
          />
        </View>
        <View style={styles.colDocs}>
          <GroupStatusPill
            tripId={tripId}
            scope="driver"
            rows={driverRows}
            onPress={() => onReview(tripId, null, "driver")}
          />
        </View>
        <View style={styles.colStage}>
          <View style={[styles.stagePill, { backgroundColor: verification.tone.bg }]}>
            <Text style={[styles.stagePillText, { color: verification.tone.fg }]} numberOfLines={1}>
              {verification.label}
            </Text>
          </View>
          {declineActive ? (
            <View
              testID={`compliance-declined-${tripId}`}
              accessible
              accessibilityLabel={`Declined${declineReason ? `: ${declineReason}` : ""}`}
            >
              <View style={[styles.stagePill, styles.statusPillPending]}>
                <Text style={[styles.stagePillText, styles.dangerText]} numberOfLines={1}>
                  Declined
                </Text>
              </View>
              {declineReason ? (
                <Text style={styles.muted} numberOfLines={1}>
                  {declineReason}
                </Text>
              ) : null}
            </View>
          ) : null}
          {showPaymentPill ? (
            <View style={[styles.stagePill, styles.stagePillSpaced, { backgroundColor: payment.tone.bg }]}>
              <Text style={[styles.stagePillText, { color: payment.tone.fg }]} numberOfLines={1}>
                {payment.label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.colBlockers}>
          <Text style={[styles.cell, readiness.paymentReady ? styles.readyText : styles.blockedText]} numberOfLines={1}>
            {payLabel.label}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {readiness.nextAction}
          </Text>
        </View>
        <Text style={[styles.cell, styles.colMoney]}>
          {summary.advance ? `₹${summary.advance.amount.toLocaleString("en-IN")}` : "—"}
        </Text>
        <Text style={[styles.cell, styles.colMoney]}>
          {summary.balance ? `₹${summary.balance.amount.toLocaleString("en-IN")}` : "—"}
        </Text>
        <View style={styles.colAction}>
          {isVerified ? (
            <Text style={[styles.actionLink, styles.successText]} numberOfLines={1}>
              Verified
            </Text>
          ) : null}
          {!isVerified && onMarkComplianceVerified ? (
            <TouchableOpacity
              testID={`compliance-verify-${tripId}`}
              style={[styles.actionButton, styles.actionItem]}
              disabled={verifyDisabled}
              onPress={handleVerify}
              accessibilityRole="button"
              accessibilityLabel="Verify trip compliance"
              accessibilityHint={
                verifyEligibility.reason ? `${verifyEligibility.reason}. Opens trip documents.` : undefined
              }
              accessibilityState={{ disabled: verifyDisabled, busy: markingTrip }}
            >
              <Text style={[styles.actionLink, !verifyEligibility.allowed && styles.disabledLink]} numberOfLines={1}>
                {markingTrip ? "Verifying…" : "Verify"}
              </Text>
            </TouchableOpacity>
          ) : null}
          {!isVerified && onDeclineCompliance ? (
            <TouchableOpacity
              testID={`compliance-decline-${tripId}`}
              style={[styles.actionButton, styles.actionItem]}
              onPress={() => setDeclineOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${COMPLIANCE_DECLINE_ACTION_LABEL} trip compliance`}
            >
              <Text style={[styles.actionLink, styles.dangerText]} numberOfLines={1}>
                {COMPLIANCE_DECLINE_ACTION_LABEL}
              </Text>
            </TouchableOpacity>
          ) : null}
          {canManageFinance && readiness.paymentReady && onPay ? (
            <TouchableOpacity onPress={() => onPay(summary.trip.id)}>
              <Text style={styles.actionLink}>Pay</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {onDeclineCompliance ? (
        <ComplianceDeclineModal
          visible={declineOpen}
          tripLabel={`${tripIdLabel}${summary.trip.client_name ? ` · ${summary.trip.client_name}` : ""}`}
          onCancel={() => setDeclineOpen(false)}
          onSubmit={handleDeclineSubmit}
        />
      ) : null}

      {expanded ? (
        <View style={styles.expandedWrap}>
          {rows.map((row) => (
            <View key={row.key} style={styles.expandedRow}>
              <Text style={styles.expandedDocLabel}>
                {labelForDocType(row.type)} · {requirementScopeLabel(row.required)}
              </Text>
              <ComplianceStatusChip status={row.status} label={COMPLIANCE_STATUS_META[row.status].label} compact />
              <View style={styles.expandedActions}>
                {row.status === "missing" ? (
                  <TouchableOpacity onPress={() => onReview(summary.trip.id, row.key)}>
                    <Text style={styles.actionLink}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => onReview(summary.trip.id, row.key)}>
                      <Text style={styles.actionLink}>Preview</Text>
                    </TouchableOpacity>
                    {row.status !== "verified" ? (
                      <TouchableOpacity onPress={() => onReview(summary.trip.id, row.key)}>
                        <Text style={styles.actionLink}> · Approve</Text>
                      </TouchableOpacity>
                    ) : null}
                    {row.status !== "rejected" ? (
                      <TouchableOpacity onPress={() => onReview(summary.trip.id, row.key)}>
                        <Text style={[styles.actionLink, styles.rejectLink]}> · Reject</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ComplianceTripsTable({
  summaries,
  onOpenTrip,
  onOpenDetails,
  onReview,
  onMarkComplianceVerified,
  onDeclineCompliance,
  onPay,
  canManageFinance,
}: ComplianceTripsTableProps) {
  const [requiredDateSort, setRequiredDateSort] = useState<RequiredDateSort>("desc");

  const sortedSummaries = useMemo(() => {
    const copy = [...summaries];
    copy.sort((a, b) => {
      const da = requiredDateSortKey(a);
      const db = requiredDateSortKey(b);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return requiredDateSort === "asc" ? da - db : db - da;
    });
    return copy;
  }, [summaries, requiredDateSort]);

  return (
    <View style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <View style={styles.expandToggle} />
          <Text style={[styles.cell, styles.colTripId, styles.headerText]}>Trip ID</Text>
          <SortHeader
            label="Date"
            sort={requiredDateSort}
            onToggle={() => setRequiredDateSort((s) => (s === "asc" ? "desc" : "asc"))}
          />
          <Text style={[styles.cell, styles.colLoc, styles.headerText]}>From</Text>
          <Text style={[styles.cell, styles.colLoc, styles.headerText]}>To</Text>
          <Text style={[styles.cell, styles.colEway, styles.headerText]}>E-way Bill</Text>
          <Text style={[styles.cell, styles.colDocs, styles.headerText]}>Trip</Text>
          <Text style={[styles.cell, styles.colDocs, styles.headerText]}>Vehicle</Text>
          <Text style={[styles.cell, styles.colDocs, styles.headerText]}>Driver</Text>
          <Text style={[styles.cell, styles.colStage, styles.headerText]}>Stage</Text>
          <Text style={[styles.cell, styles.colBlockers, styles.headerText]}>Payment</Text>
          <Text style={[styles.cell, styles.colMoney, styles.headerText]}>Advance</Text>
          <Text style={[styles.cell, styles.colMoney, styles.headerText]}>Balance</Text>
          <Text style={[styles.cell, styles.colAction, styles.headerText]}>Action</Text>
        </View>

        {sortedSummaries.map((s) => (
          <TripRowContent
            key={s.trip.id}
            summary={s}
            onOpenTrip={onOpenTrip}
            onOpenDetails={onOpenDetails}
            onReview={onReview}
            onMarkComplianceVerified={onMarkComplianceVerified}
            onDeclineCompliance={onDeclineCompliance}
            onPay={onPay}
            canManageFinance={canManageFinance}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tableScroll: { width: "100%", minWidth: 0 },
  table: {
    width: "100%",
    minWidth: 0,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
    gap: 4,
  },
  headerRow: {
    borderTopWidth: 0,
    backgroundColor: Theme.compliancePageBg,
    paddingVertical: 8,
    alignItems: "center",
  },
  headerText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    color: Theme.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  expandToggle: { width: 18, alignItems: "center", justifyContent: "center" },
  cell: { fontSize: 12, color: Theme.textPrimary, fontWeight: "500" },
  muted: { color: Theme.textMuted, fontSize: 10, lineHeight: 13 },
  colTripId: { width: 156, maxWidth: 156, flexGrow: 0, flexShrink: 1, minWidth: 0 },
  colDate: { flex: 0.8, minWidth: 0 },
  colLoc: { flex: 1, minWidth: 0 },
  colEway: { flex: 1.1, minWidth: 0, justifyContent: "center", gap: 1 },
  ewayLine: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  ewayNumber: { flexShrink: 1 },
  ewayDate: { flexShrink: 1 },
  colDocs: { flex: 0.75, minWidth: 0, justifyContent: "center" },
  statusTouch: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusPillPending: { backgroundColor: Theme.complianceStageDocsBg },
  statusPillApproved: { backgroundColor: Theme.complianceStageSuccessBg },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  successText: { color: Theme.complianceStageSuccessFg },
  dangerText: { color: Theme.complianceStageDocsFg },
  miniPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  miniPillText: { fontSize: 9, fontWeight: "700" },
  colRequiredDate: {
    flex: 0.8,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  colStage: { flex: 0.9, minWidth: 0, justifyContent: "center", gap: 2 },
  stagePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    maxWidth: "100%",
  },
  stagePillSpaced: { marginTop: 0 },
  stagePillText: { fontSize: 10, fontWeight: "700" },
  colBlockers: { flex: 0.9, minWidth: 0 },
  readyText: { color: Theme.complianceStageSuccessFg, fontWeight: "700" },
  blockedText: { color: Theme.complianceStageDocsFg, fontWeight: "700" },
  colMoney: { flex: 0.6, minWidth: 0 },
  colAction: {
    width: 176,
    minWidth: 176,
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 10,
    alignItems: "center",
  },
  actionItem: { flexGrow: 0, flexShrink: 0 },
  actionButton: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  actionLink: { fontSize: 12, fontWeight: "700", color: Theme.complianceBulk },
  disabledLink: { color: Theme.textMuted },
  rejectLink: { color: Theme.teslaRed },
  expandedWrap: { backgroundColor: Theme.compliancePageBg, paddingLeft: 38, paddingRight: 10 },
  expandedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  expandedDocLabel: { width: 120, fontSize: 13, fontWeight: "600", color: Theme.textPrimary },
  expandedActions: { flexDirection: "row", flexWrap: "wrap", marginLeft: "auto" },
});
