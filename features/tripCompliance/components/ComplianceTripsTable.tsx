/**
 * Table workbench for the Compliance work queue — trip is the primary row,
 * expandable to reveal its documents inline. Same already-fetched
 * `ComplianceTripSummary[]`, no extra query. Inline document actions open
 * the same ComplianceDocumentReviewSheet used by the card view's "Review
 * Documents" — no duplicate approve/reject wiring.
 */
import Theme from "@/constants/Theme";
import { COMPLIANCE_STATUS_META, ComplianceStatusChip } from "@/features/tripCompliance/components/ComplianceStatusIcon";
import { COMPLIANCE_STAGE_FILTER_LABEL, type ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { deriveComplianceDocumentRows, labelForDocType, complianceProgress, requirementScopeLabel } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import { deriveComplianceQueueReadiness, paymentReadinessLabel } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { stageToneVisual } from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ComplianceTripsTableProps = {
  summaries: ComplianceTripSummary[];
  onOpenTrip: (tripId: string) => void;
  onOpenDetails?: (tripId: string) => void;
  /** Opens the review sheet; documentKey null opens straight to the document list. */
  onReview: (tripId: string, documentKey: string | null) => void;
  onPay?: (tripId: string) => void;
  canManageFinance?: boolean;
};

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
  onReview: (tripId: string, documentKey: string | null) => void;
  onPay?: (tripId: string) => void;
  canManageFinance?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => deriveComplianceDocumentRows(summary.documents), [summary.documents]);
  const progress = complianceProgress(rows);
  const readiness = useMemo(() => deriveComplianceQueueReadiness(summary), [summary]);
  const payLabel = paymentReadinessLabel(readiness);
  const stageTone = stageToneVisual(summary.stage);

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
          style={styles.colTrip}
          onPress={() => (onOpenDetails ?? onOpenTrip)(summary.trip.id)}
        >
          <Text style={styles.cell} numberOfLines={1}>
            {summary.trip.booking_ref ?? summary.trip.id.slice(0, 8)}
          </Text>
          <Text style={[styles.cell, styles.muted]} numberOfLines={1}>
            {summary.trip.client_name || "—"}
          </Text>
        </TouchableOpacity>
        <View style={styles.colStage}>
          <View style={[styles.stagePill, { backgroundColor: stageTone.bg }]}>
            <Text style={[styles.stagePillText, { color: stageTone.fg }]} numberOfLines={1}>
              {COMPLIANCE_STAGE_FILTER_LABEL[summary.stage]}
            </Text>
          </View>
        </View>
        <View style={styles.colDocs}>
          {rows.slice(0, 4).map((row) => (
            <ComplianceStatusChip key={row.key} status={row.status} label={labelForDocType(row.type)} compact />
          ))}
        </View>
        <Text style={[styles.cell, styles.colProgress]}>
          {`Verified ${progress.verified}/${progress.total}`}
        </Text>
        <View style={styles.colBlockers}>
          <Text style={[styles.cell, readiness.paymentReady ? styles.readyText : styles.blockedText]} numberOfLines={1}>
            {payLabel.label}
          </Text>
          <Text style={styles.muted} numberOfLines={2}>
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
          <TouchableOpacity onPress={() => onReview(summary.trip.id, null)}>
            <Text style={styles.actionLink}>Verify Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onOpenTrip(summary.trip.id)}>
            <Text style={[styles.actionLink, styles.viewTripLink]}>View Trip</Text>
          </TouchableOpacity>
          {canManageFinance && readiness.paymentReady && onPay ? (
            <TouchableOpacity onPress={() => onPay(summary.trip.id)}>
              <Text style={styles.actionLink}>Pay</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

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
  onPay,
  canManageFinance,
}: ComplianceTripsTableProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <View style={styles.expandToggle} />
          <Text style={[styles.cell, styles.colTrip, styles.headerText]}>Trip</Text>
          <Text style={[styles.cell, styles.colStage, styles.headerText]}>Stage</Text>
          <Text style={[styles.cell, styles.colDocs, styles.headerText]}>Documents</Text>
          <Text style={[styles.cell, styles.colProgress, styles.headerText]}>Verified</Text>
          <Text style={[styles.cell, styles.colBlockers, styles.headerText]}>Payment</Text>
          <Text style={[styles.cell, styles.colMoney, styles.headerText]}>Advance</Text>
          <Text style={[styles.cell, styles.colMoney, styles.headerText]}>Balance</Text>
          <Text style={[styles.cell, styles.colAction, styles.headerText]}>Action</Text>
        </View>

        {summaries.map((s) => (
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

const styles = StyleSheet.create({
  tableScroll: { flexGrow: 0 },
  table: {
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 920,
    backgroundColor: Theme.cardWhite,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Theme.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  headerRow: { borderTopWidth: 0, backgroundColor: Theme.compliancePageBg, paddingVertical: 10 },
  headerText: { fontSize: 10, fontWeight: "700", color: Theme.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  expandToggle: { width: 28, minHeight: 40, alignItems: "center", justifyContent: "center" },
  cell: { fontSize: 13, color: Theme.textPrimary, fontWeight: "500" },
  muted: { color: Theme.textMuted, fontSize: 11 },
  colTrip: { flex: 1.4, minWidth: 110 },
  colStage: { flex: 1.1, minWidth: 128, justifyContent: "center" },
  stagePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: "100%",
  },
  stagePillText: { fontSize: 11, fontWeight: "700" },
  colDocs: { flex: 1.8, minWidth: 140, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  colProgress: { flex: 0.9, minWidth: 88 },
  colBlockers: { flex: 1.4, minWidth: 150 },
  readyText: { color: Theme.complianceStageSuccessFg, fontWeight: "700" },
  blockedText: { color: Theme.complianceStageDocsFg, fontWeight: "700" },
  colMoney: { flex: 0.8, minWidth: 76 },
  colAction: { flex: 1.2, minWidth: 124, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  actionLink: { fontSize: 12, fontWeight: "700", color: Theme.complianceBulk },
  viewTripLink: { color: Theme.textMuted },
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
  expandedDocLabel: { width: 96, fontSize: 13, fontWeight: "600", color: Theme.textPrimary },
  expandedActions: { flexDirection: "row", flexWrap: "wrap", marginLeft: "auto" },
});
