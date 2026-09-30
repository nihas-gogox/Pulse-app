/**
 * Compact confirm card for Compliance → Export Report (Verified stage only).
 */
import Theme from "@/constants/Theme";
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
  documentCount: number;
  exporting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ComplianceExportConfirmModal({
  visible,
  documentCount,
  exporting = false,
  onCancel,
  onConfirm,
}: ComplianceExportConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const count = Math.max(0, Math.floor(documentCount));
  const ready = count > 0;
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

          <View style={styles.body}>
            <Text style={styles.count} accessibilityRole="text">
              {count}
            </Text>
            <Text style={styles.message}>
              {count === 1 ? "document ready to be downloaded" : "documents ready to be downloaded"}
            </Text>
          </View>

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
  body: {
    gap: 4,
    paddingVertical: 4,
  },
  count: {
    fontSize: 28,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
  message: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
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
