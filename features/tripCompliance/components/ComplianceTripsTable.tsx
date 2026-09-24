/**
 * Table workbench for the Compliance workbench — trip is the primary row,
 * expandable to reveal its documents inline. Same already-fetched
 * `ComplianceTripSummary[]`, no extra query. Inline document actions open
 * the same ComplianceDocumentReviewSheet used by the card view's "Review
 * Documents" — no duplicate approve/reject wiring.
 */
import Theme from "@/constants/Theme";
import { COMPLIANCE_STATUS_META, ComplianceStatusChip } from "@/features/tripCompliance/components/ComplianceStatusIcon";
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
import { getTripDisplayNumber } from "@/features/trips/services/trips.service";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

export type ComplianceTripsTableProps = {
  summaries: ComplianceTripSummary[];
  onOpenTrip: (tripId: string) => void;
  onOpenDetails?: (tripId: string) => void;
  /** Opens the review sheet; documentKey null opens straight to the document list. */
  onReview: (tripId: string, documentKey: string | null, scope?: "trip" | "vehicle" | "driver") => void;
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

function MandatoryDocChips({
  rows,
  onPressDoc,
}: {
  rows: ComplianceDocRow[];
  onPressDoc: (documentKey: string) => void;
}) {
  const mandatory = rows.filter((row) => row.required);
  return (
    <View style={styles.docChips}>
      {mandatory.map((row) => (
        <TouchableOpacity
          key={row.key}
          onPress={() => onPressDoc(row.key)}
          hitSlop={{ top: 3, bottom: 3, left: 2, right: 2 }}
        >
          <ComplianceStatusChip status={row.status} label={labelForDocType(row.type)} compact />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SortHeader({
  label,
  sort,
  onToggle,
}: {
  label: string;
  sort: RequiredDateSort;
  onToggle: () => void;
}) {
  const Icon = sort === "asc" ? ArrowUp : ArrowDown;
  return (
    <TouchableOpacity
      style={styles.colDate}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}, currently ${sort === "asc" ? "ascending" : "descending"}`}
    >
      <View style={styles.sortHeaderInner}>
        <Text style={styles.headerText}>{label}</Text>
        <Icon size={11} color={Theme.textSecondary} strokeWidth={2.4} />
      </View>
    </TouchableOpacity>
  );
}

function TripRowContent({
  summary,
  onOpenTrip,
  onOpenDetails,
  onReview,
  onPay,
  canManageFinance = false,
}: {
  summary: ComplianceTripSummary;
  onOpenTrip: (tripId: string) => void;
  onOpenDetails?: (tripId: string) => void;
  onReview: (tripId: string, documentKey: string | null, scope?: "trip" | "vehicle" | "driver") => void;
  onPay?: (tripId: string) => void;
  canManageFinance?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          style={styles.expandToggle}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          {expanded ? (
            <ChevronDown size={12} color={Theme.textSecondary} strokeWidth={2.2} />
          ) : (
            <ChevronRight size={12} color={Theme.textSecondary} strokeWidth={2.2} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.colTripId}
          onPress={() => (onOpenDetails ?? onOpenTrip)(summary.trip.id)}
        >
          <Text style={[styles.cell, styles.tripIdText]} numberOfLines={1} selectable>
            {tripIdLabel}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {summary.trip.client_name || "—"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.cell, styles.colDate]} numberOfLines={1}>
          {formatRequiredDate(summary)}
        </Text>
        <View style={styles.colRoute}>
          <Text style={[styles.cell, styles.locPrimary]} numberOfLines={1}>
            {tripFromLocation(summary)}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {tripToLocation(summary)}
          </Text>
        </View>
        <View style={styles.colDocs}>
          <MandatoryDocChips
            rows={tripMandatoryRows}
            onPressDoc={(key) => onReview(summary.trip.id, key, "trip")}
          />
        </View>
        <View style={styles.colDocs}>
          <MandatoryDocChips
            rows={vehicleRows}
            onPressDoc={(key) => onReview(summary.trip.id, key, "vehicle")}
          />
        </View>
        <View style={styles.colDocsSm}>
          <MandatoryDocChips
            rows={driverRows}
            onPressDoc={(key) => onReview(summary.trip.id, key, "driver")}
          />
        </View>
        <View style={styles.colStage}>
          <View style={[styles.stagePill, { backgroundColor: verification.tone.bg }]}>
            <View style={[styles.stageDot, { backgroundColor: verification.tone.fg }]} />
            <Text style={[styles.stagePillText, { color: verification.tone.fg }]} numberOfLines={1}>
              {verification.label}
            </Text>
          </View>
          {showPaymentPill ? (
            <View style={[styles.stagePill, { backgroundColor: payment.tone.bg }]}>
              <View style={[styles.stageDot, { backgroundColor: payment.tone.fg }]} />
              <Text style={[styles.stagePillText, { color: payment.tone.fg }]} numberOfLines={1}>
                {payment.label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.colBlockers}>
          <Text
            style={[styles.cell, readiness.paymentReady ? styles.readyText : styles.blockedText]}
            numberOfLines={1}
          >
            {payLabel.label}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {readiness.nextAction}
          </Text>
        </View>
        <Text style={[styles.cell, styles.colMoney, styles.moneyText]} numberOfLines={1}>
          {summary.advance ? `₹${summary.advance.amount.toLocaleString("en-IN")}` : "—"}
        </Text>
        <Text style={[styles.cell, styles.colMoney, styles.moneyText]} numberOfLines={1}>
          {summary.balance ? `₹${summary.balance.amount.toLocaleString("en-IN")}` : "—"}
        </Text>
        <View style={styles.colAction}>
          <TouchableOpacity
            onPress={() => onReview(summary.trip.id, null)}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={styles.actionLink}>Verify Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onOpenTrip(summary.trip.id)}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={[styles.actionLink, styles.viewTripLink]}>View Trip</Text>
          </TouchableOpacity>
          {canManageFinance && readiness.paymentReady && onPay ? (
            <TouchableOpacity
              onPress={() => onPay(summary.trip.id)}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Text style={styles.actionLink}>Pay</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {expanded ? (
        <View style={styles.expandedWrap}>
          {rows.map((row) => (
            <View key={row.key} style={styles.expandedRow}>
              <Text style={styles.expandedDocLabel} numberOfLines={1}>
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.tableScroll}
      contentContainerStyle={styles.tableScrollContent}
    >
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <View style={styles.expandToggle} />
          <Text style={[styles.colTripId, styles.headerText]}>Trip ID</Text>
          <SortHeader
            label="Date"
            sort={requiredDateSort}
            onToggle={() => setRequiredDateSort((s) => (s === "asc" ? "desc" : "asc"))}
          />
          <Text style={[styles.colRoute, styles.headerText]}>From / To</Text>
          <Text style={[styles.colDocs, styles.headerText]}>Trip</Text>
          <Text style={[styles.colDocs, styles.headerText]}>Vehicle</Text>
          <Text style={[styles.colDocsSm, styles.headerText]}>Driver</Text>
          <Text style={[styles.colStage, styles.headerText]}>Stage</Text>
          <Text style={[styles.colBlockers, styles.headerText]}>Payment</Text>
          <Text style={[styles.colMoney, styles.headerText, styles.moneyText]}>Advance</Text>
          <Text style={[styles.colMoney, styles.headerText, styles.moneyText]}>Balance</Text>
          <Text style={[styles.colAction, styles.headerText]}>Action</Text>
        </View>

        {sortedSummaries.map((s) => (
          <TripRowContent
            key={s.trip.id}
            summary={s}
            onOpenTrip={onOpenTrip}
            onOpenDetails={onOpenDetails}
            onReview={onReview}
            onPay={onPay}
            canManageFinance={canManageFinance}
          />
        ))}
      </View>
    </ScrollView>
  );
}

/** Fixed column widths keep the table dense and screen-fitted (no sparse flex stretch). */
const COL = {
  tripId: 148,
  date: 96,
  route: 118,
  docs: 90,
  docsSm: 80,
  stage: 124,
  payment: 110,
  money: 68,
  action: 80,
} as const;

const styles = StyleSheet.create({
  tableScroll: { flexGrow: 0, width: "100%" },
  tableScrollContent: {
    flexGrow: 1,
    ...(Platform.OS === "web" ? ({ minWidth: "100%" } as ViewStyle) : null),
  },
  table: {
    flexGrow: 1,
    width: "100%",
    minWidth: 1060,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.complianceCardBorder,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.complianceCardBorder,
    backgroundColor: Theme.compliancePageBg,
    paddingVertical: 8,
  },
  headerText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  sortHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  expandToggle: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cell: {
    fontSize: 12,
    color: Theme.textPrimary,
    fontWeight: "500",
    lineHeight: 15,
  },
  tripIdText: {
    fontWeight: "700",
    color: Theme.textPrimary,
    fontSize: 12,
    lineHeight: 15,
  },
  muted: {
    color: Theme.textSecondary,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
  },
  locPrimary: {
    fontWeight: "600",
    color: Theme.textPrimary,
    fontSize: 12,
    lineHeight: 15,
  },
  colTripId: { width: COL.tripId, flexShrink: 0 },
  colDate: { width: COL.date, flexShrink: 0 },
  colRoute: { width: COL.route, flexShrink: 0, justifyContent: "center" },
  colDocs: { width: COL.docs, flexShrink: 0, justifyContent: "center" },
  colDocsSm: { width: COL.docsSm, flexShrink: 0, justifyContent: "center" },
  docChips: { flexDirection: "column", alignItems: "flex-start", gap: 2 },
  colStage: { width: COL.stage, flexShrink: 0, justifyContent: "center", gap: 3 },
  stagePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: "100%",
  },
  stageDot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
  stagePillText: { fontSize: 10, fontWeight: "600", flexShrink: 1 },
  colBlockers: { width: COL.payment, flexShrink: 0, justifyContent: "center" },
  readyText: { color: Theme.complianceStageSuccessFg, fontWeight: "700", fontSize: 12 },
  blockedText: { color: Theme.complianceStageDocsFg, fontWeight: "700", fontSize: 12 },
  colMoney: { width: COL.money, flexShrink: 0, justifyContent: "center" },
  moneyText: { textAlign: "right", fontVariant: ["tabular-nums"], fontSize: 12 },
  colAction: {
    width: COL.action,
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 3,
  },
  actionLink: { fontSize: 11, fontWeight: "700", color: Theme.complianceBulk, lineHeight: 14 },
  viewTripLink: { color: Theme.textSecondary, fontWeight: "600" },
  rejectLink: { color: Theme.teslaRed },
  expandedWrap: {
    backgroundColor: Theme.compliancePageBg,
    paddingLeft: 28,
    paddingRight: 8,
  },
  expandedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.complianceCardBorder,
  },
  expandedDocLabel: {
    width: 110,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimary,
  },
  expandedActions: { flexDirection: "row", flexWrap: "wrap", marginLeft: "auto" },
});
