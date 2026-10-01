/**
 * Compact confirm card for Compliance → Export Report (Verified stage only).
 */
import Theme from "@/constants/Theme";
import { COMPLIANCE_STAGE_TONE } from "@/features/tripCompliance/utils/complianceCardVisual.util";
import { Download } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ComplianceExportConfirmModalProps = {
  visible: boolean;
  /** Verified-stage trips without a Reject remark. */
  verifiedCount: number;
  /** Verified-stage trips carrying a Reject remark. */
  rejectedCount: number;
  exporting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const VERIFIED_TONE = COMPLIANCE_STAGE_TONE.compliance_verified;
const REJECTED_TONE = COMPLIANCE_STAGE_TONE.pending_for_docs;

export function ComplianceExportConfirmModal({
  visible,
  verifiedCount,
  rejectedCount,
  exporting = false,
  onCancel,
  onConfirm,
}: ComplianceExportConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const verified = Math.max(0, Math.floor(verifiedCount));
  const rejected = Math.max(0, Math.floor(rejectedCount));
  const total = verified + rejected;
  const ready = total > 0;
  const confirmDisabled = !ready || exporting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={exporting ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss export confirmation"
        />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Download size={16} color={Theme.textPrimaryDark} strokeWidth={2.2} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Export Report</Text>
              <Text style={styles.eyebrow}>Verified stage only</Text>
            </View>
          </View>

          <View style={styles.stats}>
            {(
              [
                { key: "verified", label: "Verified", value: verified, tone: VERIFIED_TONE },
                { key: "rejected", label: "Rejected", value: rejected, tone: REJECTED_TONE },
              ] as const
            ).map((stat) => (
              <View
                key={stat.key}
                style={styles.statTile}
                accessible
                accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()} ${stat.value === 1 ? "trip" : "trips"}`}
              >
                <View style={styles.statLabelRow}>
                  <View style={[styles.statDot, { backgroundColor: stat.tone.fg }]} />
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                <Text style={[styles.statValue, stat.value > 0 && { color: stat.tone.fg }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statUnit}>{stat.value === 1 ? "trip" : "trips"}</Text>
              </View>
            ))}
          </View>

          {ready ? (
            <Text style={styles.message}>
              {total} {total === 1 ? "trip" : "trips"} will be included in the report
            </Text>
          ) : null}

          {!ready ? (
            <Text style={styles.emptyHint}>Nothing in Verified stage to export yet.</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Cancel export"
              accessibilityState={{ disabled: exporting }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, confirmDisabled && styles.confirmBtnDisabled]}
              onPress={onConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityLabel="Confirm export"
              accessibilityState={{ disabled: confirmDisabled }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={Theme.cardWhite} />
              ) : (
                <Text style={styles.confirmText}>Confirm</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: Theme.cardWhite,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.complianceTripCardBorder,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
    shadowColor: Theme.textPrimaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.brandBlueSoft,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: Theme.textMuted,
  },
  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    gap: 2,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: Theme.textSecondary,
  },
  statValue: {
    marginTop: 2,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  message: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    color: Theme.textMuted,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.complianceStageDocsFg,
    lineHeight: 16,
    marginTop: -4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 2,
  },
  cancelBtn: {
    minHeight: 38,
    minWidth: 84,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textMuted,
  },
  confirmBtn: {
    minHeight: 38,
    minWidth: 92,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: Theme.buttonDark,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.buttonDarkText,
  },
});
