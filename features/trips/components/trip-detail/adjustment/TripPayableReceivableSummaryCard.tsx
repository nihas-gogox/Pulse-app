import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { EntityAvatar } from "@/components/EntityAvatar";
import Theme from "@/constants/Theme";
import { formatINR } from "@/lib/format";
import type { ProvisionFinanceLayout } from "@/features/trips/components/trip-detail/adjustment/ProvisionRevisedPartiesCard";

export interface SettlementLaneProps {
  partyName: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  organizationImageUrl?: string | null;
  organizationAvatarSeed?: string | null;
  isIntegrated?: boolean;
  entityType: "client" | "supplier" | "driver";
  laneLabel: string;
  revisedAmount: number;
  settledAmount: number;
  dueAmount: number;
  accentColor: string;
  onPress?: () => void;
  /**
   * Read-only informational note under the lane, e.g. "MAX marked ₹63,000 paid".
   * Does NOT count toward settled/due — pure shared-ledger visibility.
   */
  infoNote?: string;
}

function SettlementLaneCard({
  partyName,
  avatarUrl,
  avatarSeed,
  organizationImageUrl,
  organizationAvatarSeed,
  isIntegrated,
  entityType,
  laneLabel,
  revisedAmount,
  settledAmount,
  dueAmount,
  accentColor,
  onPress,
  infoNote,
  layout = "mobile",
}: SettlementLaneProps & { layout?: ProvisionFinanceLayout }) {
  const isDesktop = layout === "desktop";
  const isSettled = dueAmount <= 0;
  const dueColor = isSettled ? Theme.textMuted : accentColor;
  const settledDeltaColor =
    entityType === "client" ? Theme.positive : accentColor;
  const canPreview = settledAmount > 0 && Boolean(onPress);
  const cardStyle = [
    styles.card,
    isDesktop && styles.cardDesktop,
    canPreview && styles.cardPressable,
  ];

  const content = (
    <>
      <View style={[styles.cardHead, isDesktop && styles.cardHeadDesktop]}>
        <EntityAvatar
          name={partyName}
          avatarUrl={avatarUrl}
          avatarSeed={avatarSeed}
          organizationImageUrl={organizationImageUrl}
          organizationAvatarSeed={organizationAvatarSeed}
          isIntegrated={isIntegrated}
          entityType={entityType}
          size={isDesktop ? 32 : 28}
          showIntegrationBadge={false}
        />
        <View style={styles.cardHeadText}>
          <Text style={[styles.laneLabel, isDesktop && styles.laneLabelDesktop]}>
            {laneLabel}
          </Text>
          <Text
            style={[styles.partyName, isDesktop && styles.partyNameDesktop]}
            numberOfLines={1}
          >
            {partyName}
          </Text>
        </View>
        <View style={styles.dueBlock}>
          <Text style={[styles.metricLabel, styles.metricLabelEnd, isDesktop && styles.metricLabelDesktop]}>
            Due
          </Text>
          <Text
            style={[
              styles.dueHero,
              isDesktop && styles.dueHeroDesktop,
              { color: dueColor },
            ]}
            numberOfLines={1}
          >
            {isSettled ? "Settled" : formatINR(dueAmount)}
          </Text>
        </View>
      </View>

      <View style={[styles.metricsBar, isDesktop && styles.metricsBarDesktop]}>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, isDesktop && styles.metricLabelDesktop]}>
            Revised
          </Text>
          <Text
            style={[
              styles.metricValueMuted,
              isDesktop && styles.metricValueMutedDesktop,
            ]}
            numberOfLines={1}
          >
            {formatINR(revisedAmount)}
          </Text>
        </View>
        <Feather
          name="arrow-right"
          size={isDesktop ? 16 : 14}
          color={Theme.textMuted}
          style={styles.metricArrow}
        />
        <View style={[styles.metricCell, styles.metricCellEnd]}>
          <Text
            style={[
              styles.metricDeltaHero,
              isDesktop && styles.metricDeltaHeroDesktop,
              { color: settledDeltaColor },
            ]}
            numberOfLines={1}
          >
            {settledAmount > 0 ? "−" : ""}
            {settledAmount > 0 ? formatINR(settledAmount) : "Nothing recorded"}
          </Text>
          {settledAmount > 0 ? (
            <Text
              style={[
                styles.metricSettledHint,
                styles.metricLabelEnd,
                isDesktop && styles.metricSettledHintDesktop,
              ]}
            >
              {entityType === "client" ? "Collected" : "Paid"}
            </Text>
          ) : null}
        </View>
      </View>
      {infoNote ? (
        <View style={styles.infoNoteRow}>
          <Text style={styles.infoNoteText} numberOfLines={1}>
            {infoNote}
          </Text>
        </View>
      ) : null}
    </>
  );

  if (canPreview) {
    return (
      <Pressable
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Preview ${laneLabel.toLowerCase()} transactions for ${partyName}`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

export interface TripPayableReceivableSummaryCardProps {
  showReceivable?: boolean;
  clientName: string;
  clientAvatarUrl?: string | null;
  clientAvatarSeed?: string | null;
  clientOrganizationImageUrl?: string | null;
  clientOrganizationAvatarSeed?: string | null;
  clientIntegrated?: boolean;
  revisedReceivable: number;
  collectedAmount: number;
  receivableDue: number;
  /** Read-only note under the receivable, e.g. "MAX marked ₹63,000 paid". Non-counting. */
  receivableInfoNote?: string;
  showPayable?: boolean;
  payablePartyName: string;
  payableAvatarUrl?: string | null;
  payableAvatarSeed?: string | null;
  payableOrganizationImageUrl?: string | null;
  payableOrganizationAvatarSeed?: string | null;
  payableIntegrated?: boolean;
  payableEntityType?: "supplier" | "driver" | "dco";
  payableLaneLabel?: string;
  revisedPayable: number;
  paidAmount: number;
  payableDue: number;
  layout?: ProvisionFinanceLayout;
  onPressReceivable?: () => void;
  onPressPayable?: () => void;
  receivableAction?: ReactNode;
  receivableActionHint?: ReactNode;
  payableAction?: ReactNode;
  payableActionHint?: ReactNode;
}

function LaneActionFooter({
  action,
  hint,
  isDesktop,
}: {
  action?: ReactNode;
  hint?: ReactNode;
  isDesktop: boolean;
}) {
  if (!action) return null;
  return (
    <View
      style={[
        styles.laneActionFooter,
        !isDesktop && styles.laneActionFooterMobile,
        isDesktop && styles.laneActionFooterDesktop,
      ]}
    >
      <View
        style={[
          styles.laneActionBtnSlot,
          !isDesktop && styles.laneActionBtnSlotMobile,
        ]}
      >
        {action}
      </View>
      {hint ? (
        <View
          style={[
            styles.laneActionHintSlot,
            isDesktop && styles.laneActionHintSlotDesktop,
          ]}
        >
          {hint}
        </View>
      ) : null}
    </View>
  );
}

export const TripPayableReceivableSummaryCard = memo(
  function TripPayableReceivableSummaryCard(
    props: TripPayableReceivableSummaryCardProps,
  ) {
    const showReceivable = props.showReceivable !== false;
    const showPayable = Boolean(props.showPayable);
    const layout = props.layout ?? "mobile";
    const isDesktop = layout === "desktop";
    if (!showReceivable && !showPayable) return null;

    return (
      <View style={[styles.wrap, isDesktop && styles.wrapDesktop]}>
        {showReceivable ? (
          <View
            style={[styles.laneColumn, isDesktop && styles.laneColumnDesktop]}
          >
            <View style={[styles.laneCardGrow, isDesktop && styles.laneCardGrowDesktop]}>
              <SettlementLaneCard
                partyName={props.clientName}
                avatarUrl={props.clientAvatarUrl}
                avatarSeed={props.clientAvatarSeed}
                organizationImageUrl={props.clientOrganizationImageUrl}
                organizationAvatarSeed={props.clientOrganizationAvatarSeed}
                isIntegrated={props.clientIntegrated}
                entityType="client"
                laneLabel="Receivable"
                revisedAmount={props.revisedReceivable}
                settledAmount={props.collectedAmount}
                dueAmount={props.receivableDue}
                infoNote={props.receivableInfoNote}
                accentColor={Theme.primary}
                onPress={props.onPressReceivable}
                layout={layout}
              />
            </View>
            <LaneActionFooter
              action={props.receivableAction}
              hint={props.receivableActionHint}
              isDesktop={isDesktop}
            />
          </View>
        ) : null}
        {showPayable ? (
          <View
            style={[styles.laneColumn, isDesktop && styles.laneColumnDesktop]}
          >
            <View style={[styles.laneCardGrow, isDesktop && styles.laneCardGrowDesktop]}>
              <SettlementLaneCard
                partyName={props.payablePartyName}
                avatarUrl={props.payableAvatarUrl}
                avatarSeed={props.payableAvatarSeed}
                organizationImageUrl={props.payableOrganizationImageUrl}
                organizationAvatarSeed={props.payableOrganizationAvatarSeed}
                isIntegrated={props.payableIntegrated}
                entityType={
                  props.payableEntityType === "dco"
                    ? "supplier"
                    : (props.payableEntityType ?? "supplier")
                }
                laneLabel={props.payableLaneLabel ?? "Payable"}
                revisedAmount={props.revisedPayable}
                settledAmount={props.paidAmount}
                dueAmount={props.payableDue}
                accentColor="#0f766e"
                onPress={props.onPressPayable}
                layout={layout}
              />
            </View>
            <LaneActionFooter
              action={props.payableAction}
              hint={props.payableActionHint}
              isDesktop={isDesktop}
            />
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    marginBottom: 4,
    width: "100%",
  },
  wrapDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 2,
  },
  laneColumn: {
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "stretch",
  },
  laneColumnDesktop: {
    flex: 1,
    flexBasis: 0,
    alignSelf: "stretch",
  },
  laneCardGrow: {
    width: "100%",
    minWidth: 0,
  },
  laneCardGrowDesktop: {
    flex: 1,
    minHeight: 0,
  },
  laneActionFooter: {
    width: "100%",
    minWidth: 0,
    marginTop: 8,
    gap: 4,
  },
  laneActionFooterMobile: {
    marginTop: 8,
  },
  laneActionFooterDesktop: {
    marginTop: "auto" as const,
    paddingTop: 8,
  },
  laneActionBtnSlot: {
    width: "100%",
    minHeight: 38,
    justifyContent: "center",
    alignItems: "stretch",
  },
  laneActionBtnSlotMobile: {
    minHeight: 44,
  },
  laneActionHintSlot: {
    width: "100%",
    justifyContent: "flex-start",
  },
  laneActionHintSlotDesktop: {
    minHeight: 16,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e6edf5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    gap: 8,
  },
  cardDesktop: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  cardPressable: {
    cursor: "pointer",
  },
  cardPressed: {
    opacity: 0.92,
    backgroundColor: Theme.surface,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeadDesktop: {
    gap: 10,
  },
  cardHeadText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dueBlock: {
    flexShrink: 0,
    alignItems: "flex-end",
    gap: 2,
    maxWidth: "46%",
    paddingLeft: 6,
  },
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
  partyName: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  partyNameDesktop: {
    fontSize: 13,
    lineHeight: 17,
  },
  dueHero: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.35,
    fontVariant: ["tabular-nums"],
    lineHeight: 20,
    textAlign: "right",
  },
  dueHeroDesktop: {
    fontSize: 20,
    lineHeight: 24,
  },
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eef2f7",
  },
  metricsBarDesktop: {
    gap: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  metricCellEnd: {
    alignItems: "flex-end",
  },
  metricArrow: {
    flexShrink: 0,
  },
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
  metricDeltaHero: {
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.15,
    lineHeight: 15,
    textAlign: "right",
  },
  metricDeltaHeroDesktop: {
    fontSize: 13,
    lineHeight: 16,
  },
  metricSettledHint: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 9,
  },
  metricSettledHintDesktop: {
    fontSize: 8,
    lineHeight: 10,
  },
  infoNoteRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Theme.border,
  },
  infoNoteText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textMuted,
  },
});
