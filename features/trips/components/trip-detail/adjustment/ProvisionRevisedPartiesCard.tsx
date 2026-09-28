import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { EntityAvatar } from "@/components/EntityAvatar";
import { FinanceTxnTypography } from "@/constants/FinanceTxnTypography";
import Theme from "@/constants/Theme";
import { formatINR } from "@/lib/format";

export type ProvisionCostBreakdownLine = {
  label: string;
  amount: number;
  variant?: "default" | "section" | "child" | "emphasis" | "good";
  /** Share of the revised trip cost, 0–100. Shown as a "(NN%)" suffix. */
  percentOfTotal?: number;
  /** Explanatory sub-text under the label, e.g. how salary was derived. */
  note?: string;
};

const BREAKDOWN_COL_AMT = 76;

function CostBreakdownTable({
  lines,
  totalAmount,
  totalLabel = "Revised trip cost",
}: {
  lines: ProvisionCostBreakdownLine[];
  totalAmount: number;
  totalLabel?: string;
}) {
  const rowKeys = useMemo(
    () =>
      lines.map((line, index) => {
        const variant = line.variant ?? "default";
        return `${variant}-${line.label}-${line.amount}-${index}`;
      }),
    [lines],
  );

  return (
    <View style={styles.breakdownTable}>
      <View style={styles.breakdownTableHead}>
        <Text style={styles.breakdownTh} numberOfLines={1}>
          Line item
        </Text>
        <View style={styles.breakdownColAmt}>
          <Text style={[styles.breakdownTh, styles.breakdownThAmt]} numberOfLines={1}>
            Amount
          </Text>
        </View>
      </View>

      {lines.map((line, index) => {
        const variant = line.variant ?? "default";
        const isChild = variant === "child";
        const isSection = variant === "section";
        const valueColor =
          variant === "emphasis"
            ? Theme.warning
            : variant === "good"
              ? Theme.positive
              : Theme.textPrimaryDark;

        return (
          <View
            key={rowKeys[index]}
            style={[
              styles.breakdownTr,
              isSection && styles.breakdownTrSection,
              isChild && styles.breakdownTrChild,
              index === lines.length - 1 && styles.breakdownTrLast,
            ]}
          >
            <View style={styles.breakdownLabelCell}>
              {isChild ? (
                <Text style={styles.breakdownChildPrefix} accessibilityElementsHidden>
                  └
                </Text>
              ) : null}
              <View style={styles.breakdownLabelTextWrap}>
                <Text
                  style={[
                    styles.breakdownTdLabel,
                    isChild && styles.breakdownTdLabelChild,
                    isSection && styles.breakdownTdLabelSection,
                  ]}
                  numberOfLines={2}
                >
                  {line.label}
                </Text>
                {line.note ? (
                  <Text style={styles.breakdownTdNote} numberOfLines={1}>
                    {line.note}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.breakdownColAmt}>
              <Text
                style={[
                  styles.breakdownTdAmt,
                  { color: valueColor },
                  isSection && styles.breakdownTdAmtSection,
                ]}
                numberOfLines={1}
              >
                {formatINR(line.amount)}
              </Text>
              {typeof line.percentOfTotal === "number" ? (
                <Text style={styles.breakdownTdPct} numberOfLines={1}>
                  {line.percentOfTotal}%
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={styles.breakdownTableFoot}>
        <Text style={styles.breakdownFootLabel} numberOfLines={1}>
          {totalLabel}
        </Text>
        <View style={styles.breakdownColAmt}>
          <Text
            style={[
              styles.breakdownFootAmt,
              totalAmount < 0 && styles.breakdownFootAmtLoss,
            ]}
            numberOfLines={1}
          >
            {formatINR(totalAmount)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export interface ProvisionPartyLaneProps {
  partyName: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  organizationImageUrl?: string | null;
  organizationAvatarSeed?: string | null;
  isIntegrated?: boolean;
  entityType: "client" | "supplier" | "driver";
  laneLabel: string;
  baseAmount: number;
  revisedAmount: number;
  delta: number;
  accentColor: string;
  active?: boolean;
  onPress?: () => void;
  breakdownLines?: ProvisionCostBreakdownLine[];
  /**
   * True when the underlying rate (e.g. trip.supplier_rate) was never entered rather than
   * genuinely being ₹0. Renders "Not set" instead of a misleading ₹0 that reads as settled.
   */
  amountUnset?: boolean;
}

function PartyLaneCard({
  partyName,
  avatarUrl,
  avatarSeed,
  organizationImageUrl,
  organizationAvatarSeed,
  isIntegrated,
  entityType,
  laneLabel,
  baseAmount,
  revisedAmount,
  delta,
  accentColor,
  active,
  onPress,
  breakdownLines,
  amountUnset,
  layout = "mobile",
  variant = "default",
}: ProvisionPartyLaneProps & {
  layout?: ProvisionFinanceLayout;
  variant?: "default" | "modal";
}) {
  const isDesktop = layout === "desktop";
  const isModal = variant === "modal";
  const content = (
    <>
      <View style={styles.cardHead}>
        <EntityAvatar
          name={partyName}
          avatarUrl={avatarUrl}
          avatarSeed={avatarSeed}
          organizationImageUrl={organizationImageUrl}
          organizationAvatarSeed={organizationAvatarSeed}
          isIntegrated={isIntegrated}
          entityType={entityType}
          size={isModal ? 36 : isDesktop ? 32 : 28}
          showIntegrationBadge={false}
        />
        <View style={styles.cardHeadText}>
          <Text
            style={[
              styles.laneLabel,
              isDesktop && styles.laneLabelDesktop,
              isModal && styles.laneLabelModal,
            ]}
          >
            {laneLabel}
          </Text>
          <Text
            style={[
              styles.partyName,
              isDesktop && styles.partyNameDesktop,
              isModal && styles.partyNameModal,
            ]}
            numberOfLines={2}
          >
            {partyName}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.metricsBar,
          isDesktop && styles.metricsBarDesktop,
          isModal && styles.metricsBarModal,
        ]}
      >
        <View
          style={[
            styles.metricCell,
            isDesktop && styles.metricCellDesktop,
            isModal && styles.metricCellModal,
          ]}
        >
          <Text
            style={[
              styles.metricLabel,
              isDesktop && styles.metricLabelDesktop,
              isModal && styles.metricLabelModal,
            ]}
          >
            Base
          </Text>
          <Text
            style={[
              styles.metricValueMuted,
              isDesktop && styles.metricValueMutedDesktop,
              isModal && styles.metricValueMutedModal,
            ]}
          >
            {amountUnset ? "Not set" : formatINR(baseAmount)}
          </Text>
        </View>
        <Feather
          name="arrow-right"
          size={isModal ? 16 : isDesktop ? 16 : 14}
          color={Theme.textMuted}
          style={[styles.metricArrow, isDesktop && styles.metricArrowDesktop]}
        />
        <View
          style={[
            styles.metricCell,
            styles.metricCellEnd,
            isDesktop && styles.metricCellEndDesktop,
            isModal && styles.metricCellEndModal,
          ]}
        >
          <Text
            style={[
              styles.metricLabel,
              styles.metricLabelEnd,
              isDesktop && styles.metricLabelDesktop,
              isModal && styles.metricLabelModal,
            ]}
          >
            Revised
          </Text>
          <Text
            style={[
              styles.metricValueHero,
              isDesktop && styles.metricValueHeroDesktop,
              isModal && styles.metricValueHeroModal,
              { color: amountUnset ? Theme.textMuted : accentColor },
            ]}
          >
            {amountUnset ? "Not set" : formatINR(revisedAmount)}
          </Text>
          {amountUnset ? (
            <Text
              style={[
                styles.metricDeltaHero,
                isDesktop && styles.metricDeltaHeroDesktop,
                isModal && styles.metricDeltaHeroModal,
                { color: Theme.warning },
              ]}
            >
              Rate not entered
            </Text>
          ) : (
            <Text
              style={[
                styles.metricDeltaHero,
                isDesktop && styles.metricDeltaHeroDesktop,
                isModal && styles.metricDeltaHeroModal,
                {
                  color:
                    delta < 0 && entityType === "client"
                      ? Theme.negative
                      : delta > 0 && entityType !== "client"
                        ? Theme.negative
                        : accentColor,
                },
              ]}
            >
              {delta >= 0 ? "+" : "−"}
              {formatINR(Math.abs(delta))}
            </Text>
          )}
        </View>
      </View>
      {breakdownLines && breakdownLines.length > 0 ? (
        <CostBreakdownTable
          lines={breakdownLines}
          totalAmount={revisedAmount}
          totalLabel={
            laneLabel.toLowerCase().includes("cost")
              ? "Revised trip cost"
              : "Revised total"
          }
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.card,
          isDesktop && styles.cardDesktop,
          isModal && styles.cardModal,
          active && { borderColor: accentColor, backgroundColor: `${accentColor}0c` },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, isDesktop && styles.cardDesktop, isModal && styles.cardModal]}>
      {content}
    </View>
  );
}

export type ProvisionFinanceLayout = "mobile" | "desktop";

export interface ProvisionRevisedPartiesCardProps {
  clientName: string;
  clientAvatarUrl?: string | null;
  clientAvatarSeed?: string | null;
  clientOrganizationImageUrl?: string | null;
  clientOrganizationAvatarSeed?: string | null;
  clientIntegrated?: boolean;
  sales: number;
  adjSales: number;
  revenueSideDelta: number;
  supplierName: string;
  supplierAvatarUrl?: string | null;
  supplierAvatarSeed?: string | null;
  supplierOrganizationImageUrl?: string | null;
  supplierOrganizationAvatarSeed?: string | null;
  supplierIntegrated?: boolean;
  cost: number;
  adjCost: number;
  costSideDelta: number;
  /** Asset trips: driver + posted expenses instead of supplier. */
  costLaneLabel?: string;
  costPartyEntityType?: "supplier" | "driver";
  costBreakdownLines?: ProvisionCostBreakdownLine[];
  /** True when the supplier/cost rate was never entered on the trip (see amountUnset on PartyLaneCard). */
  costUnset?: boolean;
  activeSide?: "client" | "supplier" | null;
  onSelectSide?: (side: "client" | "supplier") => void;
  compact?: boolean;
  layout?: ProvisionFinanceLayout;
  /** Modal hub — roomier single-lane card aligned with mobile wizard. */
  variant?: "default" | "modal";
}

export const ProvisionRevisedPartiesCard = memo(function ProvisionRevisedPartiesCard(
  props: ProvisionRevisedPartiesCardProps,
) {
  const showClient = props.activeSide !== "supplier";
  const showSupplier = props.activeSide !== "client";
  const layout = props.layout ?? "mobile";
  const isDesktop = layout === "desktop";
  const variant = props.variant ?? "default";

  return (
    <View
      style={[
        styles.wrap,
        props.compact && styles.wrapCompact,
        isDesktop && styles.wrapDesktop,
        variant === "modal" && styles.wrapModal,
      ]}
    >
      {showClient ? (
        <PartyLaneCard
          partyName={props.clientName}
          avatarUrl={props.clientAvatarUrl}
          avatarSeed={props.clientAvatarSeed}
          organizationImageUrl={props.clientOrganizationImageUrl}
          organizationAvatarSeed={props.clientOrganizationAvatarSeed}
          isIntegrated={props.clientIntegrated}
          entityType="client"
          laneLabel="Revised sale"
          baseAmount={props.sales}
          revisedAmount={props.adjSales}
          delta={props.revenueSideDelta}
          accentColor={Theme.primary}
          active={props.activeSide === "client"}
          onPress={props.onSelectSide ? () => props.onSelectSide!("client") : undefined}
          layout={layout}
          variant={variant}
        />
      ) : null}
      {showSupplier ? (
        <PartyLaneCard
          partyName={props.supplierName}
          avatarUrl={props.supplierAvatarUrl}
          avatarSeed={props.supplierAvatarSeed}
          organizationImageUrl={props.supplierOrganizationImageUrl}
          organizationAvatarSeed={props.supplierOrganizationAvatarSeed}
          isIntegrated={props.supplierIntegrated}
          entityType={props.costPartyEntityType ?? "supplier"}
          laneLabel={props.costLaneLabel ?? "Revised cost"}
          baseAmount={props.cost}
          revisedAmount={props.adjCost}
          delta={props.costSideDelta}
          accentColor="#0f766e"
          active={props.activeSide === "supplier"}
          onPress={props.onSelectSide ? () => props.onSelectSide!("supplier") : undefined}
          breakdownLines={props.costBreakdownLines}
          amountUnset={props.costUnset}
          layout={layout}
          variant={variant}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { gap: 6 },
  wrapModal: {
    gap: 0,
    marginBottom: 4,
  },
  wrapDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e6edf5",
    borderRadius: 12,
    padding: 8,
    backgroundColor: "#fff",
    gap: 6,
  },
  cardDesktop: {
    flex: 1,
    minWidth: 0,
    alignSelf: "flex-start",
    padding: 10,
    borderRadius: 12,
    gap: 6,
  },
  cardModal: {
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 0,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeadText: { flex: 1, minWidth: 0, gap: 2 },
  laneLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 10,
  },
  laneLabelDesktop: {
    fontSize: 10,
    letterSpacing: 0.7,
    lineHeight: 12,
  },
  laneLabelModal: {
    fontSize: 10,
    lineHeight: 12,
  },
  partyName: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  partyNameDesktop: {
    fontSize: 13,
    lineHeight: 17,
  },
  partyNameModal: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eef2f7",
  },
  metricsBarDesktop: {
    gap: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  metricsBarModal: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 2,
  },
  metricCell: { flex: 1, minWidth: 0, gap: 4 },
  metricCellDesktop: { maxWidth: undefined },
  metricCellModal: { flex: 1, minWidth: 0 },
  metricCellEnd: { alignItems: "flex-end" },
  metricCellEndDesktop: { marginLeft: "auto" as const },
  metricCellEndModal: { flex: 1.1, minWidth: 0 },
  metricArrow: { flexShrink: 0 },
  metricArrowDesktop: { marginHorizontal: 2 },
  metricLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 10,
  },
  metricLabelDesktop: {
    fontSize: 10,
    lineHeight: 12,
  },
  metricLabelModal: {
    fontSize: 10,
    lineHeight: 12,
  },
  metricLabelEnd: {
    textAlign: "right",
  },
  metricValueMuted: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.25,
    lineHeight: 17,
  },
  metricValueMutedDesktop: {
    fontSize: 16,
    lineHeight: 20,
  },
  metricValueMutedModal: {
    fontSize: 17,
    lineHeight: 21,
  },
  metricValueHero: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.45,
    fontVariant: ["tabular-nums"],
    lineHeight: 26,
  },
  metricValueHeroDesktop: {
    fontSize: 24,
    lineHeight: 28,
  },
  metricValueHeroModal: {
    fontSize: 26,
    lineHeight: 30,
  },
  metricDeltaHero: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.15,
    lineHeight: 15,
  },
  metricDeltaHeroDesktop: {
    fontSize: 13,
    lineHeight: 16,
  },
  metricDeltaHeroModal: {
    fontSize: 13,
    lineHeight: 16,
  },
  breakdownTable: {
    borderWidth: 1,
    borderColor: "#eef2f7",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fafbfc",
  },
  breakdownTableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecf4",
  },
  breakdownTh: {
    ...FinanceTxnTypography.fieldLabel,
    flex: 1,
    fontSize: 8,
    lineHeight: 11,
    minWidth: 0,
  },
  breakdownThAmt: {
    textAlign: "right",
    flex: 0,
    width: "100%",
  },
  breakdownColAmt: {
    width: BREAKDOWN_COL_AMT,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  breakdownTr: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8ecf4",
    backgroundColor: "#fff",
  },
  breakdownTrSection: {
    backgroundColor: "#f8fafc",
    minHeight: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  breakdownTrChild: {
    backgroundColor: "#fcfdfe",
    minHeight: 26,
  },
  breakdownTrLast: {
    borderBottomWidth: 0,
  },
  breakdownLabelCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 6,
  },
  breakdownChildPrefix: {
    fontSize: 9,
    fontWeight: "400",
    color: "#cbd5e1",
    lineHeight: 12,
    width: 8,
    flexShrink: 0,
  },
  breakdownLabelTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  breakdownTdLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Theme.textSecondary,
    lineHeight: 13,
    minWidth: 0,
  },
  breakdownTdNote: {
    fontSize: 8.5,
    fontWeight: "400",
    color: Theme.textMuted,
    lineHeight: 11,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  breakdownTdPct: {
    fontSize: 8.5,
    fontWeight: "500",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    lineHeight: 11,
    marginTop: 1,
  },
  breakdownTdLabelChild: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
    paddingLeft: 2,
  },
  breakdownTdLabelSection: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.1,
  },
  breakdownTdAmt: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    lineHeight: 13,
  },
  breakdownTdAmtSection: {
    fontWeight: "700",
  },
  breakdownTableFoot: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  breakdownFootLabel: {
    flex: 1,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#64748b",
    lineHeight: 11,
    minWidth: 0,
    paddingRight: 6,
  },
  breakdownFootAmt: {
    width: BREAKDOWN_COL_AMT,
    fontSize: 11,
    fontWeight: "800",
    color: "#0f766e",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    letterSpacing: -0.15,
    lineHeight: 14,
  },
  breakdownFootAmtLoss: {
    color: Theme.negative,
    fontSize: 12,
    fontWeight: "900",
  },
});
