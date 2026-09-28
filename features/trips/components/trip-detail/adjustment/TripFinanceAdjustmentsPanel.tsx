import { memo, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { EntityAvatar } from "@/components/EntityAvatar";
import {
  ProvisionRevisedPartiesCard,
  type ProvisionCostBreakdownLine,
  type ProvisionFinanceLayout,
} from "@/features/trips/components/trip-detail/adjustment/ProvisionRevisedPartiesCard";
import Theme from "@/constants/Theme";
import { formatINR } from "@/lib/format";
import type { TripAdjustment } from "@/features/trips/services/tripAdjustments";
import { isAdjustmentVoided } from "@/features/trips/services/tripAdjustments";
import { ProvisionPassThroughCard } from "@/features/trips/components/trip-detail/adjustment/ProvisionPassThroughCard";
import {
  selectClientPassThroughRecommendations,
  type ClientPassThroughRecommendation,
} from "@/features/trips/components/trip-detail/adjustment/tripAdjustmentPassThrough.util";

const LINK = "#2874F0";
const INK = "#212121";
const BODY = "#616161";
const MUTED = "#9E9E9E";
const CANVAS = "#F5F5F5";

export interface TripFinanceAdjustmentsPanelProps {
  adjustments: TripAdjustment[];
  sales: number;
  adjSales: number;
  revenueSideDelta: number;
  cost: number;
  adjCost: number;
  costSideDelta: number;
  clientName: string;
  clientAvatarUrl?: string | null;
  clientAvatarSeed?: string | null;
  clientOrganizationImageUrl?: string | null;
  clientOrganizationAvatarSeed?: string | null;
  clientIntegrated?: boolean;
  supplierName: string;
  supplierAvatarUrl?: string | null;
  supplierAvatarSeed?: string | null;
  supplierOrganizationImageUrl?: string | null;
  supplierOrganizationAvatarSeed?: string | null;
  supplierIntegrated?: boolean;
  /** Asset execution: cost lane is driver labor + posted trip expenses. */
  isAssetExecution?: boolean;
  costLaneLabel?: string;
  costBreakdownLines?: ProvisionCostBreakdownLine[];
  /** True when the supplier/cost rate was never entered on the trip (renders "Not set" instead of a false ₹0). */
  costUnset?: boolean;
  lineMetaLabel: (adj: TripAdjustment) => string;
  /**
   * False hides the +Sale / +Cost toolbar for a viewer without
   * `finance.void_adjustments`. Defaults to true so existing callers are
   * unchanged. The modal itself is separately gated in useTripDetail.
   */
  canAddAdjustment?: boolean;
  onOpenProvision: (side: "client" | "supplier") => void;
  onRequestDeduction?: (rec: ClientPassThroughRecommendation) => void;
  onViewNotePdf?: (adj: TripAdjustment) => void;
  onEditAdjustment?: (adj: TripAdjustment) => void;
  capturePaymentSlot?: ReactNode;
  layout?: ProvisionFinanceLayout;
}

function cnDnLabel(impact: TripAdjustment["impact"]): string {
  return impact === "minus" ? "CN" : "DN";
}

function laneLabel(type: TripAdjustment["type"]): string {
  return type === "revenue" ? "Sale" : "Cost";
}

/** Fixed widths for compact columns; party+lane and reason share flexible space. */
const COL_NOTE = 40;
const COL_AMT = 78;

export const TripFinanceAdjustmentsPanel = memo(function TripFinanceAdjustmentsPanel(
  props: TripFinanceAdjustmentsPanelProps,
) {
  const rows = useMemo(
    () =>
      [...(Array.isArray(props.adjustments) ? props.adjustments : [])].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      ),
    [props.adjustments],
  );

  const activeCount = rows.filter((a) => !isAdjustmentVoided(a)).length;
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const layout = props.layout ?? "mobile";
  const isDesktop = layout === "desktop";
  const colAmt = isDesktop ? 92 : COL_AMT;

  const passThroughRecommendations = useMemo(
    () =>
      selectClientPassThroughRecommendations({
        adjustments: Array.isArray(props.adjustments) ? props.adjustments : [],
        isAssetExecution: Boolean(props.isAssetExecution),
        driverOrSupplierName: props.supplierName,
      }),
    [props.adjustments, props.isAssetExecution, props.supplierName],
  );

  return (
    <View style={[styles.card, isDesktop && styles.cardDesktop]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
            Provision adjustments
          </Text>
          <Text style={[styles.hint, isDesktop && styles.hintDesktop]}>
            {props.isAssetExecution
              ? "Customer sale vs driver cost & posted expenses"
              : "Revised sale & cost after CN/DN lines"}
          </Text>
        </View>
        <View style={[styles.badge, isDesktop && styles.badgeDesktop]}>
          <Text style={[styles.badgeText, isDesktop && styles.badgeTextDesktop]}>
            {activeCount}
          </Text>
        </View>
      </View>

      {/* Mobile chrome already shows sale/cost once — avoid repeating party totals. */}
      {isDesktop ? (
        <ProvisionRevisedPartiesCard
          clientName={props.clientName}
          clientAvatarUrl={props.clientAvatarUrl}
          clientAvatarSeed={props.clientAvatarSeed}
          clientOrganizationImageUrl={props.clientOrganizationImageUrl}
          clientOrganizationAvatarSeed={props.clientOrganizationAvatarSeed}
          clientIntegrated={props.clientIntegrated}
          sales={props.sales}
          adjSales={props.adjSales}
          revenueSideDelta={props.revenueSideDelta}
          supplierName={props.supplierName}
          supplierAvatarUrl={props.supplierAvatarUrl}
          supplierAvatarSeed={props.supplierAvatarSeed}
          supplierOrganizationImageUrl={props.supplierOrganizationImageUrl}
          supplierOrganizationAvatarSeed={props.supplierOrganizationAvatarSeed}
          supplierIntegrated={props.supplierIntegrated}
          cost={props.cost}
          adjCost={props.adjCost}
          costSideDelta={props.costSideDelta}
          costLaneLabel={props.costLaneLabel}
          costPartyEntityType={props.isAssetExecution ? "driver" : "supplier"}
          costBreakdownLines={props.costBreakdownLines}
          costUnset={props.costUnset}
          onSelectSide={props.onOpenProvision}
          layout={layout}
        />
      ) : props.capturePaymentSlot ? (
        <View style={styles.mobileCaptureFirst}>{props.capturePaymentSlot}</View>
      ) : null}

      {props.onRequestDeduction && passThroughRecommendations.length > 0 ? (
        <ProvisionPassThroughCard
          recommendations={passThroughRecommendations}
          isAssetExecution={Boolean(props.isAssetExecution)}
          onRequestDeduction={props.onRequestDeduction}
        />
      ) : null}

      <View style={styles.tableToolbar}>
        <Text style={[styles.tableTitle, isDesktop && styles.tableTitleDesktop]}>
          Adjustment lines
        </Text>
        {props.canAddAdjustment !== false && (
        <View style={styles.toolbarActions}>
          <Pressable
            style={[styles.addBtnSale, isDesktop && styles.addBtnDesktop]}
            onPress={() => props.onOpenProvision("client")}
          >
            <Feather name="plus" size={isDesktop ? 13 : 12} color={Theme.primary} />
            <Text style={[styles.addBtnSaleText, isDesktop && styles.addBtnTextDesktop]}>
              Sale
            </Text>
          </Pressable>
          <Pressable
            style={[styles.addBtnCost, isDesktop && styles.addBtnDesktop]}
            onPress={() => props.onOpenProvision("supplier")}
          >
            <Feather name="plus" size={isDesktop ? 13 : 12} color="#0f766e" />
            <Text style={[styles.addBtnCostText, isDesktop && styles.addBtnTextDesktop]}>
              {props.isAssetExecution ? "Driver" : "Cost"}
            </Text>
          </Pressable>
        </View>
        )}
      </View>

      <View style={[styles.table, isDesktop && styles.tableDesktop]}>
        <View style={[styles.tableHead, isDesktop && styles.tableHeadDesktop]}>
          <View style={[styles.colPartyLane, isDesktop && styles.colPartyLaneDesktop]}>
            <Text style={[styles.th, isDesktop && styles.thDesktop]} numberOfLines={1}>
              Party
            </Text>
          </View>
          {isDesktop ? (
            <>
              <View style={styles.colNote}>
                <Text style={[styles.th, styles.thDesktop]} numberOfLines={1}>
                  Note
                </Text>
              </View>
              <View style={styles.colReason}>
                <Text style={[styles.th, styles.thDesktop]} numberOfLines={1}>
                  Reason
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.colNoteReason}>
              <Text style={styles.th} numberOfLines={1}>
                Note / reason
              </Text>
            </View>
          )}
          <View style={[styles.colAmt, { width: colAmt }]}>
            <Text style={[styles.th, styles.thAmt, isDesktop && styles.thDesktop]} numberOfLines={1}>
              Amount
            </Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={[styles.empty, isDesktop && styles.emptyDesktop]}>
            No provisions yet — tap Sale or Cost to add a CN/DN.
          </Text>
        ) : (
          rows.map((adj) => {
            const voided = isAdjustmentVoided(adj);
            const isSale = adj.type === "revenue";
            const partyName = isSale ? props.clientName : props.supplierName;
            const costEntityType = props.isAssetExecution ? "driver" : "supplier";
            const isSelected = selectedRowId === adj.id;
            const canEdit = !voided && typeof props.onEditAdjustment === "function";
            const reasonText = (adj.reason ?? "").trim() || "—";
            const notePill = (
              <Pressable
                style={[
                  styles.notePill,
                  adj.impact === "minus" ? styles.notePillCn : styles.notePillDn,
                  voided && styles.notePillVoided,
                ]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  props.onViewNotePdf?.(adj);
                }}
                disabled={!props.onViewNotePdf}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`View ${cnDnLabel(adj.impact)} PDF`}
              >
                <Text
                  style={[
                    styles.notePillText,
                    adj.impact === "minus" ? styles.noteCn : styles.noteDn,
                    voided && styles.struck,
                  ]}
                >
                  {cnDnLabel(adj.impact)}
                </Text>
                {props.onViewNotePdf ? (
                  <Feather
                    name="file-text"
                    size={9}
                    color={adj.impact === "minus" ? Theme.primary : "#0f766e"}
                    style={styles.notePillIcon}
                  />
                ) : null}
              </Pressable>
            );
            return (
              <View key={adj.id} style={styles.trWrap}>
              <Pressable
                style={[
                  styles.tr,
                  isDesktop && styles.trDesktop,
                  voided && styles.trVoided,
                  isSelected && styles.trSelected,
                ]}
                onPress={() =>
                  setSelectedRowId((prev) => (prev === adj.id ? null : adj.id))
                }
              >
                <View style={[styles.colPartyLane, isDesktop && styles.colPartyLaneDesktop]}>
                  <EntityAvatar
                    name={partyName}
                    avatarUrl={isSale ? props.clientAvatarUrl : props.supplierAvatarUrl}
                    avatarSeed={isSale ? props.clientAvatarSeed : props.supplierAvatarSeed}
                    organizationImageUrl={
                      isSale
                        ? props.clientOrganizationImageUrl
                        : props.supplierOrganizationImageUrl
                    }
                    organizationAvatarSeed={
                      isSale
                        ? props.clientOrganizationAvatarSeed
                        : props.supplierOrganizationAvatarSeed
                    }
                    isIntegrated={
                      isSale ? props.clientIntegrated : props.supplierIntegrated
                    }
                    entityType={isSale ? "client" : costEntityType}
                    size={isDesktop ? 24 : 22}
                    showIntegrationBadge={false}
                  />
                  <View style={styles.partyLaneBody}>
                    <Text
                      style={[
                        styles.partyCell,
                        isDesktop && styles.partyCellDesktop,
                        voided && styles.struck,
                      ]}
                      numberOfLines={2}
                    >
                      {partyName}
                    </Text>
                    <View
                      style={[
                        styles.laneChip,
                        isSale ? styles.laneChipSale : styles.laneChipCost,
                        voided && styles.laneChipVoided,
                      ]}
                    >
                      <Text
                        style={[
                          styles.laneChipText,
                          isSale ? styles.laneChipTextSale : styles.laneChipTextCost,
                          voided && styles.struck,
                        ]}
                        numberOfLines={1}
                      >
                        {laneLabel(adj.type)}
                      </Text>
                    </View>
                  </View>
                </View>
                {isDesktop ? (
                  <>
                    <View style={styles.colNote}>{notePill}</View>
                    <View style={styles.colReason}>
                      <Text
                        style={[
                          styles.td,
                          styles.tdReason,
                          styles.tdDesktop,
                          voided && styles.struck,
                        ]}
                        numberOfLines={3}
                      >
                        {reasonText}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.colNoteReason}>
                    {notePill}
                    <Text
                      style={[
                        styles.td,
                        styles.tdReason,
                        voided && styles.struck,
                      ]}
                      numberOfLines={2}
                    >
                      {reasonText}
                    </Text>
                  </View>
                )}
                <View style={[styles.colAmt, { width: colAmt }]}>
                  <Text
                    style={[
                      styles.td,
                      styles.tdAmt,
                      isDesktop && styles.tdAmtDesktop,
                      isSale ? styles.amtSale : styles.amtCost,
                      voided && styles.struck,
                    ]}
                    numberOfLines={1}
                  >
                    {adj.impact === "plus" ? "+" : "−"}
                    {formatINR(adj.amount)}
                  </Text>
                </View>
              </Pressable>

              {isSelected ? (
                <View style={styles.rowActions}>
                  {props.onViewNotePdf ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.rowActionBtn,
                        pressed && styles.rowActionBtnPressed,
                      ]}
                      onPress={() => props.onViewNotePdf?.(adj)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${cnDnLabel(adj.impact)} PDF`}
                    >
                      <Feather name="file-text" size={12} color={LINK} />
                      <Text style={styles.rowActionBtnText}>View PDF</Text>
                    </Pressable>
                  ) : null}
                  {canEdit ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.rowActionBtn,
                        styles.rowActionBtnPrimary,
                        pressed && styles.rowActionBtnPressed,
                      ]}
                      onPress={() => props.onEditAdjustment?.(adj)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${cnDnLabel(adj.impact)}`}
                    >
                      <Feather name="edit-2" size={12} color={LINK} />
                      <Text style={styles.rowActionBtnTextPrimary}>
                        Edit {cnDnLabel(adj.impact)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Desktop: capture under lines. Mobile: already shown above. */}
      {isDesktop ? props.capturePaymentSlot : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: 0,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  mobileCaptureFirst: {
    marginBottom: 2,
  },
  cardDesktop: {
    marginTop: 0,
    backgroundColor: Theme.cardWhite,
    paddingVertical: 2,
    paddingHorizontal: 0,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
    textTransform: "none",
    color: INK,
    lineHeight: 18,
  },
  titleDesktop: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    lineHeight: 14,
  },
  hint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
    color: MUTED,
  },
  hintDesktop: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CANVAS,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  badgeDesktop: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: BODY,
    fontVariant: ["tabular-nums"],
  },
  badgeTextDesktop: {
    fontSize: 11,
  },
  tableToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 2,
  },
  tableTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "none",
    color: INK,
    lineHeight: 14,
  },
  tableTitleDesktop: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 12,
  },
  toolbarActions: { flexDirection: "row", gap: 6 },
  addBtnDesktop: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnTextDesktop: {
    fontSize: 10,
  },
  addBtnSale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(40,116,240,0.08)",
  },
  addBtnSaleText: {
    fontSize: 11,
    fontWeight: "600",
    color: LINK,
    textTransform: "none",
    letterSpacing: 0,
  },
  addBtnCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(15,118,110,0.08)",
  },
  addBtnCostText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f766e",
    textTransform: "none",
    letterSpacing: 0,
  },
  table: {
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EEEEEE",
    backgroundColor: Theme.cardWhite,
  },
  tableDesktop: {
    borderRadius: 8,
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: CANVAS,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  tableHeadDesktop: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  th: {
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 13,
    color: MUTED,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  thDesktop: {
    fontSize: 10,
    lineHeight: 13,
  },
  thAmt: {
    textAlign: "right",
    width: "100%",
  },
  colPartyLane: {
    flex: 1.05,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  colPartyLaneDesktop: {
    flex: 1,
    minWidth: 140,
    maxWidth: 220,
    gap: 8,
    paddingRight: 8,
  },
  partyLaneBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  colNote: {
    width: COL_NOTE,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  colReason: {
    flex: 1.35,
    minWidth: 72,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  colNoteReason: {
    flex: 1.45,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  colAmt: {
    width: COL_AMT,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  empty: {
    padding: 14,
    fontSize: 12,
    fontWeight: "400",
    color: MUTED,
    textAlign: "center",
    lineHeight: 16,
  },
  emptyDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 12,
    lineHeight: 16,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Theme.cardWhite,
  },
  trDesktop: {
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "flex-start",
  },
  trWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
    backgroundColor: Theme.cardWhite,
  },
  trSelected: {
    backgroundColor: "#FAFBFF",
  },
  rowActions: {
    flexDirection: "row",
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEEEEE",
    backgroundColor: CANVAS,
  },
  rowActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    minHeight: 44,
    backgroundColor: CANVAS,
  },
  rowActionBtnPrimary: {
    backgroundColor: CANVAS,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#E0E0E0",
  },
  rowActionBtnPressed: {
    opacity: 0.75,
    backgroundColor: "#EEEEEE",
  },
  rowActionBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: LINK,
  },
  rowActionBtnTextPrimary: {
    fontSize: 12,
    fontWeight: "500",
    color: LINK,
  },
  trVoided: { opacity: 0.55 },
  td: {
    fontSize: 12,
    fontWeight: "400",
    color: BODY,
    lineHeight: 16,
  },
  tdDesktop: {
    fontSize: 11,
    lineHeight: 15,
  },
  partyCell: {
    fontStyle: "normal",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    color: INK,
    minWidth: 0,
    textTransform: "none",
  },
  partyCellDesktop: {
    fontSize: 11,
    lineHeight: 14,
  },
  laneChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  laneChipSale: {
    backgroundColor: "rgba(40,116,240,0.08)",
    borderColor: "rgba(40,116,240,0.2)",
  },
  laneChipCost: {
    backgroundColor: "rgba(15,118,110,0.08)",
    borderColor: "rgba(15,118,110,0.2)",
  },
  laneChipVoided: {
    opacity: 0.75,
  },
  laneChipText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  laneChipTextSale: {
    color: LINK,
  },
  laneChipTextCost: {
    color: "#0f766e",
  },
  notePill: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  notePillIcon: {
    marginTop: 0,
  },
  notePillCn: {
    backgroundColor: "rgba(40,116,240,0.1)",
  },
  notePillDn: {
    backgroundColor: "rgba(225,29,72,0.08)",
  },
  notePillVoided: {
    opacity: 0.7,
  },
  notePillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  noteCn: { color: LINK },
  noteDn: { color: "#e11d48" },
  tdReason: {
    flex: 1,
    minWidth: 0,
    fontWeight: "400",
    color: BODY,
    fontSize: 12,
    lineHeight: 16,
  },
  tdAmt: {
    fontSize: 12,
    textAlign: "right",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    lineHeight: 16,
  },
  tdAmtDesktop: {
    fontSize: 11,
    lineHeight: 15,
  },
  amtSale: { color: Theme.gpayAmountReceived },
  amtCost: { color: Theme.teslaRed },
  struck: {
    textDecorationLine: "line-through",
    opacity: 0.75,
  },
});
