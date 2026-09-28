import { Wallet } from "lucide-react-native";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import Theme from "@/constants/Theme";
import { formatINR } from "@/lib/format";
import type { FeePaymentStatus } from "@/features/network/services/marketBids.service";

export type IndentAllocationMarketplaceFeePanelProps = {
  feeStatus: FeePaymentStatus | null;
  feeAmount: number | null;
  busy?: boolean;
  onPayCash: () => void;
};

function feeCopy(status: FeePaymentStatus | null, amount: number | null): string {
  const feeLabel = amount != null && amount > 0 ? formatINR(amount) : "the Marketplace fee";
  switch (status) {
    case "pending":
      return `Payment of ${feeLabel} is still processing. Confirm cash to unlock convert.`;
    case "failed":
      return `Payment of ${feeLabel} failed. Confirm cash to retry.`;
    case "paid":
    case "not_required":
      return "Marketplace fee is settled. You can convert this award to a trip.";
    default:
      return `Pay ${feeLabel} to Pulse before converting this Marketplace award. Online checkout is coming soon — cash is recorded on your Finance ledger.`;
  }
}

export const IndentAllocationMarketplaceFeePanel = memo(
  function IndentAllocationMarketplaceFeePanel({
    feeStatus,
    feeAmount,
    busy = false,
    onPayCash,
  }: IndentAllocationMarketplaceFeePanelProps) {
    const settled = feeStatus === "paid" || feeStatus === "not_required";
    const amountLabel =
      feeAmount != null && feeAmount > 0 ? formatINR(feeAmount) : "—";

    return (
      <View style={styles.card} accessibilityRole="summary">
        <View style={styles.iconWrap}>
          <Wallet size={16} color={Theme.textPrimaryDark} strokeWidth={2.2} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>Marketplace fee</Text>
          <Text style={styles.amount}>{amountLabel}</Text>
          <Text style={styles.body}>{feeCopy(feeStatus, feeAmount)}</Text>
        </View>
        {!settled ? (
          <Pressable
            onPress={onPayCash}
            disabled={busy}
            style={({ pressed }) => [styles.payBtn, pressed && styles.payBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Confirm marketplace fee as cash"
          >
            {busy ? (
              <ActivityIndicator size="small" color={Theme.textOnPrimary} />
            ) : (
              <Text style={styles.payBtnText}>Pay with cash</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.paidPill}>
            <Text style={styles.paidPillText}>Paid</Text>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  body: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  payBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Theme.textPrimaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  payBtnPressed: {
    opacity: 0.88,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textOnPrimary,
  },
  paidPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Theme.surfaceGray,
  },
  paidPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.positive,
  },
});
