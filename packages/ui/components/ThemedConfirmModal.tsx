import Theme from "@pulse/core/constants/Theme";
import Layout from "@pulse/core/constants/Layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ThemedConfirmModalVariant = "neutral" | "warning" | "positive";

export interface ThemedConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onRequestClose?: () => void;
  variant?: ThemedConfirmModalVariant;
  confirmVariant?: "primary" | "secondary" | "destructive";
}

type VariantConfig = {
  accentColor: string;
  iconName: string;
  iconInnerBg: string;
  iconBg: string;
  /** Filled primary / proceed button (driver app: emerald) */
  confirmButtonBg: string;
  /** Icon glyph in inner circle (use full white for green on light) */
  iconColor: string;
};

export function ThemedConfirmModal({
  visible,
  title,
  message,
  cancelText = "Cancel",
  confirmText = "Confirm",
  onCancel,
  onConfirm,
  onRequestClose,
  variant = "neutral",
  confirmVariant = "primary",
}: ThemedConfirmModalProps) {
  const insets = useSafeAreaInsets();

  const variantConfig = React.useMemo((): VariantConfig => {
    if (variant === "warning") {
      return {
        accentColor: Theme.negative,
        iconName: "exclamation",
        iconInnerBg: Theme.negative,
        iconBg: Theme.negativeMuted || "rgba(239, 68, 68, 0.12)",
        confirmButtonBg: Theme.buttonMatteBlack,
        iconColor: "#FFFFFF",
      };
    }
    if (variant === "positive") {
      return {
        accentColor: Theme.driverEmerald,
        iconName: "check",
        iconInnerBg: Theme.driverEmerald,
        iconBg: Theme.driverEmeraldMuted,
        confirmButtonBg: Theme.driverEmerald,
        iconColor: "#FFFFFF",
      };
    }
    return {
      accentColor: Theme.modalNeutralAccent,
      iconName: "question",
      iconInnerBg: Theme.modalNeutralAccent,
      iconBg: Theme.modalNeutralIconWash,
      confirmButtonBg: Theme.buttonMatteBlack,
      iconColor: "#FFFFFF",
    };
  }, [variant]);

  const confirmTextStyle =
    confirmVariant === "secondary" ? styles.textSecondary : styles.textPrimary;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onRequestClose ?? onCancel}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.card}>
          <View style={[styles.accentBar, { backgroundColor: variantConfig.accentColor }]} />

          <View style={[styles.iconCircle, { backgroundColor: variantConfig.iconBg }]}>
            <View style={[styles.iconInnerCircle, { backgroundColor: variantConfig.iconInnerBg }]}>
              <FontAwesome
                name={variantConfig.iconName as keyof typeof FontAwesome.glyphMap}
                size={14}
                color={variantConfig.iconColor}
              />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.buttonBase, styles.buttonSecondary]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[styles.textBase, styles.textSecondary]}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={[
                styles.buttonBase,
                confirmVariant === "destructive" && styles.buttonDestructive,
                confirmVariant === "secondary" && styles.buttonSecondary,
                confirmVariant === "primary" && { backgroundColor: variantConfig.confirmButtonBg },
              ]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[styles.textBase, confirmTextStyle]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.overlayBackdrop,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.screenPaddingHorizontal,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Theme.cardWhite,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    alignItems: "center",
    shadowColor: Theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  accentBar: {
    position: "absolute",
    top: 10,
    width: 36,
    height: 3,
    borderRadius: 999,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  iconInnerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 12,
    fontWeight: "400",
    color: Theme.textSecondary,
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  buttonBase: {
    flex: 1,
    borderRadius: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonSecondary: {
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.borderLight,
  },
  buttonDestructive: {
    backgroundColor: Theme.negative,
  },
  textBase: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.05,
  },
  textPrimary: {
    color: Theme.buttonMatteBlackText,
  },
  textSecondary: {
    color: Theme.textPrimaryDark,
  },
});
