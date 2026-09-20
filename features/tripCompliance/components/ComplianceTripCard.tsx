/**
 * Compliance Verification card — trip identity, route, vehicle/driver,
 * Trip/Vehicle/Driver 5-slot checklist, stage pill, and Verify Docs.
 */
import Theme from "@/constants/Theme";
import { COMPLIANCE_STAGE_FILTER_LABEL, type ComplianceChecklistGroup, type ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import {
  complianceEventAt,
  complianceTripDisplayId,
  formatComplianceTimestamp,
  groupToneVisual,
  splitPlace,
  stageToneVisual,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { checklistTone, ensureComplianceChecklist } from "@/features/tripCompliance/utils/complianceChecklist.util";
import {
  deriveComplianceQueueReadiness,
  paymentReadinessLabel,
} from "@/features/tripCompliance/utils/complianceReadiness.util";
import { Check, Clock, Eye, Truck, User } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ComplianceTripCardProps = {
  summary: ComplianceTripSummary;
  onReviewDocuments: (group: ComplianceChecklistGroup["key"]) => void;
  onViewTrip: () => void;
  onOpenDetails?: () => void;
  onPay?: () => void;
  canManageFinance?: boolean;
};

function ChecklistGroupTile({
  group,
  countLabel,
  onPress,
}: {
  group: ComplianceChecklistGroup;
  countLabel: string;
  onPress?: () => void;
}) {
  const tone = groupToneVisual(group.tone);
  const content = (
    <>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupLabel, { color: tone.fg }]} numberOfLines={1}>
          {group.label}
        </Text>
        <Eye size={11} color={tone.fg} strokeWidth={2.2} />
      </View>
      <View style={styles.groupDots}>
        {group.slots.map((slot) => (
          <View
            key={slot.type}
            style={[styles.groupDot, { backgroundColor: slot.verified ? tone.dot : tone.emptyDot }]}
          />
        ))}
      </View>
      <Text style={[styles.groupCount, { color: tone.fg }]}>{countLabel}</Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.groupTile, { backgroundColor: tone.bg }]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.label} documents, ${countLabel}`}
      style={[styles.groupTile, { backgroundColor: tone.bg }]}
    >
      {content}
    </TouchableOpacity>
  );
}

export function ComplianceTripCard({
  summary,
  onReviewDocuments,
  onViewTrip,
  onOpenDetails,
  onPay,
  canManageFinance = false,
}: ComplianceTripCardProps) {
  const trip = summary.trip;
  const pickup = splitPlace(trip.pickup_area);
  const drop = splitPlace(trip.drop_location);
  const checklist = ensureComplianceChecklist(summary);
  const readiness = useMemo(() => deriveComplianceQueueReadiness(summary), [summary]);
  const required = readiness.requiredDocs;
  const verifiedTripTypes = new Set(
    summary.documents.filter((doc) => doc.status === "verified").map((doc) => doc.document_type),
  );
  const displayGroups = checklist.groups.map((group) => {
    if (group.key !== "trip") return group;
    const slots = group.slots.map((slot) => ({ ...slot, verified: verifiedTripTypes.has(slot.type) }));
    return {
      ...group,
      slots,
      verified: required.verified,
      total: required.total,
      tone: checklistTone(required.verified, required.total),
    };
  });
  const stageTone = stageToneVisual(summary.stage);
  const requiredTone = groupToneVisual(checklistTone(required.verified, required.total));
  const tripId = complianceTripDisplayId(trip);
  const when = formatComplianceTimestamp(complianceEventAt(trip));
  const fullyVerified = Boolean(summary.complianceVerifiedAt);
  const payLabel = paymentReadinessLabel(readiness);
  const vehicleLabel = trip.vehicle_display_number?.trim() || "Unassigned";
  const driverLabel = trip.driver_display_name?.trim() || "Unassigned";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Truck size={12} color={Theme.complianceBulk} strokeWidth={2.1} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.tripIdLabel}>TRIP ID</Text>
            <TouchableOpacity
              onPress={onOpenDetails ?? onViewTrip}
              accessibilityRole="button"
              accessibilityLabel="Open compliance details"
            >
              <Text style={styles.tripCode} numberOfLines={1}>
                {tripId}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.timeWrap}>
          <Clock size={11} color={Theme.textMuted} strokeWidth={2.1} />
          <Text style={styles.timeText} numberOfLines={1}>
            {when}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.routeCol}>
          <View style={styles.routeStop}>
            <View style={styles.routeRail}>
              <View style={[styles.routeDot, { backgroundColor: Theme.complianceRoutePickup }]} />
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.routeCity} numberOfLines={1}>
                {pickup.city}
              </Text>
              {pickup.region ? (
                <Text style={styles.routeRegion} numberOfLines={1}>
                  {pickup.region}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.routeStop}>
            <View style={styles.routeRail}>
              <View style={[styles.routeDot, { backgroundColor: Theme.complianceRouteDrop }]} />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.routeCity} numberOfLines={1}>
                {drop.city}
              </Text>
              {drop.region ? (
                <Text style={styles.routeRegion} numberOfLines={1}>
                  {drop.region}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.assetCol}>
          <View style={styles.assetRow}>
            <Truck size={11} color={Theme.textMuted} strokeWidth={2.1} />
            <Text style={styles.assetText} numberOfLines={1}>
              {vehicleLabel}
            </Text>
          </View>
          <View style={styles.assetRow}>
            <User size={11} color={Theme.textMuted} strokeWidth={2.1} />
            <Text style={styles.assetText} numberOfLines={1}>
              {driverLabel}
            </Text>
          </View>
        </View>
      </View>

      <View>
        <View style={styles.checklistHeader}>
          <Text style={styles.checklistTitle}>REQUIRED DOCUMENTS</Text>
          <Text style={[styles.checklistProgress, { color: requiredTone.fg }]}>
            {required.verified}/{required.total} verified
          </Text>
        </View>
        <View style={styles.groupRow}>
          {displayGroups.map((group) => (
            <ChecklistGroupTile
              key={group.key}
              group={group}
              countLabel={
                group.key === "trip"
                  ? `${required.verified}/${required.total} Verified`
                  : `${group.verified}/${group.total} On file`
              }
              onPress={() => onReviewDocuments(group.key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.blockerBox}>
        <Text style={[styles.payLabel, readiness.paymentReady ? styles.payReady : styles.payBlocked]}>
          {payLabel.label}
        </Text>
        {fullyVerified ? <Text style={styles.blockerLine}>Compliance Verified ✓</Text> : null}
        <Text style={styles.blockerLine}>Next: {readiness.nextAction}</Text>
        {readiness.blockerLines.slice(0, 3).map((line) => (
          <Text key={line} style={styles.blockerLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.footerRow}>
        <View style={[styles.stagePill, { backgroundColor: stageTone.bg }]}>
          {summary.stage === "compliance_verified" || summary.stage === "payment_settled" ? (
            <Check size={10} color={stageTone.fg} strokeWidth={2.6} />
          ) : (
            <View style={[styles.stageDot, { backgroundColor: stageTone.fg }]} />
          )}
          <Text style={[styles.stagePillText, { color: stageTone.fg }]} numberOfLines={1}>
            {COMPLIANCE_STAGE_FILTER_LABEL[summary.stage] ?? summary.stage}
          </Text>
        </View>
        {fullyVerified ? (
          <TouchableOpacity
            style={styles.verifiedBtn}
            onPress={() => onReviewDocuments("trip")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Documents verified"
          >
            <Check size={12} color={Theme.complianceVerifiedPillFg} strokeWidth={2.4} />
            <Text style={styles.verifiedBtnText}>Compliance verified</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => onReviewDocuments("trip")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Verify documents"
          >
            <Check size={12} color={Theme.complianceBulkText} strokeWidth={2.4} />
            <Text style={styles.verifyBtnText}>Verify Docs</Text>
          </TouchableOpacity>
        )}
        {canManageFinance && readiness.paymentReady && onPay ? (
          <TouchableOpacity style={styles.verifyBtn} onPress={onPay} accessibilityRole="button">
            <Text style={styles.verifyBtnText}>Pay</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: Theme.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    padding: 12,
    gap: 10,
    shadowColor: Theme.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: Theme.complianceIconWash,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  tripIdLabel: { fontSize: 8, fontWeight: "700", color: Theme.textMuted, letterSpacing: 0.5, lineHeight: 10 },
  tripCode: { fontSize: 13, fontWeight: "800", color: Theme.complianceBulk, marginTop: 0, lineHeight: 16 },
  timeWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0, maxWidth: "52%" },
  timeText: { fontSize: 10, color: Theme.textMuted, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  routeCol: { flex: 1, minWidth: 0, gap: 2 },
  routeStop: { flexDirection: "row", alignItems: "flex-start", gap: 6, minWidth: 0 },
  routeRail: { width: 8, alignItems: "center", paddingTop: 3 },
  routeDot: { width: 7, height: 7, borderRadius: 4 },
  routeLine: {
    width: 1.5,
    height: 10,
    backgroundColor: Theme.complianceCardBorder,
    marginTop: 1,
    marginBottom: 1,
  },
  routeCopy: { flex: 1, minWidth: 0 },
  routeCity: { fontSize: 12, fontWeight: "700", color: Theme.textPrimary, lineHeight: 15 },
  routeRegion: { fontSize: 9, color: Theme.textMuted, lineHeight: 12 },
  assetCol: { flex: 0.85, minWidth: 0, maxWidth: 148, gap: 6 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  assetText: { flex: 1, fontSize: 10, fontWeight: "600", color: Theme.textPrimary, minWidth: 0 },
  checklistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 5 },
  checklistTitle: { fontSize: 9, fontWeight: "700", color: Theme.textMuted, letterSpacing: 0.4 },
  checklistProgress: { fontSize: 9, fontWeight: "700" },
  groupRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  groupTile: { flex: 1, minWidth: 84, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 3 },
  groupLabel: { fontSize: 10, fontWeight: "700", flex: 1, minWidth: 0 },
  groupDots: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 2 },
  groupDot: { width: 5, height: 5, borderRadius: 3 },
  groupCount: { fontSize: 8, fontWeight: "700" },
  blockerBox: { gap: 2, paddingTop: 2 },
  payLabel: { fontSize: 11, fontWeight: "800" },
  payReady: { color: Theme.complianceStageSuccessFg },
  payBlocked: { color: Theme.complianceStageDocsFg },
  blockerLine: { fontSize: 10, color: Theme.textMuted, lineHeight: 14 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  stagePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stagePillText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  verifyBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Theme.complianceBulk,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  verifyBtnText: { fontSize: 12, fontWeight: "700", color: Theme.complianceBulkText },
  verifiedBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Theme.complianceVerifiedPillBg,
    borderWidth: 1,
    borderColor: Theme.complianceVerifiedPillBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  verifiedBtnText: { fontSize: 12, fontWeight: "700", color: Theme.complianceVerifiedPillFg },
});
