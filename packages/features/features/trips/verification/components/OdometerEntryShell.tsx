import Feather from "@expo/vector-icons/Feather";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "@pulse/core/constants/Layout";
import Theme from "@pulse/core/constants/Theme";
import { ExpenseBillScanOverlay } from "../../operations/shared/ExpenseBillScanOverlay";
import {
  DriverOpsEntryIcon,
  driverOpsEntryStyles as ops,
} from "@pulse/domain/features/trips/operations/shared/driverOpsEntry.styles";
import { dockPaddingBottom, useKeyboardVisible } from "@pulse/core/lib/hooks/useKeyboardVisible";

import type { OdometerScanState } from "@pulse/domain/features/trips/verification/odometerScan.types";

type AttachmentProps = {
  uri: string | null;
  busy?: boolean;
  onAttach: () => void;
  onRemove?: () => void;
};

type Props = {
  title: string;
  subtitle: string;
  kicker?: string;
  onBack: () => void;
  footer: ReactNode;
  scan: OdometerScanState;
  attachment: AttachmentProps;
  children: ReactNode | ((openPhotoPreview: () => void) => ReactNode);
};

export function OdometerEntryShell({
  title,
  subtitle,
  kicker = "Odometer reading",
  onBack,
  footer,
  scan,
  attachment,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { keyboardVisible } = useKeyboardVisible();
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasAttachment = !!attachment.uri?.trim();
  const scanActive = scan.phase === "preparing" || scan.phase === "analyzing";
  const openPhotoPreview = () => {
    if (hasAttachment) setPreviewOpen(true);
  };

  const scanMessage = useMemo(() => {
    if (!scanActive) return undefined;
    return scan.message.trim() || "Reading odometer digits…";
  }, [scan.message, scanActive]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled={Platform.OS !== "web"}
    >
      <View style={styles.body}>
        <View
          style={[
            ops.header,
            {
              paddingTop: insets.top + 8,
              backgroundColor: Theme.driverEmeraldDark,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <View style={ops.headerTopRow}>
            <Pressable style={ops.backBtn} onPress={onBack} hitSlop={10}>
              <Feather name="arrow-left" size={DriverOpsEntryIcon.back} color="#fff" />
              <Text style={ops.backText}>Back</Text>
            </Pressable>

            <View style={styles.attachRow}>
              <View style={ops.attachCluster}>
                {hasAttachment ? (
                  <>
                    <Pressable
                      style={[ops.attachThumbBtn, scanActive && ops.attachThumbBtnScanning]}
                      onPress={() => setPreviewOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="View odometer photo"
                    >
                      <Image
                        source={{ uri: attachment.uri! }}
                        style={ops.attachThumb}
                        resizeMode="cover"
                      />
                      <ExpenseBillScanOverlay visible={scanActive} label="Reading KM" />
                    </Pressable>
                    {attachment.onRemove ? (
                      <Pressable
                        style={ops.attachRemoveBtn}
                        onPress={attachment.onRemove}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Remove odometer photo"
                      >
                        <Feather name="x" size={DriverOpsEntryIcon.headerThumb} color="#fff" />
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
                <Pressable
                  style={[ops.attachBtn, hasAttachment && ops.attachBtnSecondary]}
                  onPress={attachment.onAttach}
                  disabled={attachment.busy}
                  accessibilityRole="button"
                  accessibilityLabel={hasAttachment ? "Retake odometer photo" : "Attach odometer photo"}
                >
                  {attachment.busy ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={ops.attachBtnText}>
                        {scanActive ? "Scanning…" : "Working…"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Feather
                        name={hasAttachment ? "refresh-cw" : "camera"}
                        size={DriverOpsEntryIcon.headerAction}
                        color="#fff"
                      />
                      <Text style={ops.attachBtnText}>
                        {hasAttachment ? "Retake" : "Attach photo"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          <View style={ops.heroRow}>
            <View style={ops.heroIcon}>
              <Feather name="activity" size={DriverOpsEntryIcon.hero} color={Theme.driverEmeraldDark} />
            </View>
            <View style={ops.heroCopy}>
              <Text style={ops.heroKicker}>{kicker}</Text>
              <Text style={ops.heroTitle}>{title}</Text>
              <View style={ops.routeInline}>
                <Feather name="navigation" size={9} color="rgba(255,255,255,0.8)" />
                <Text style={ops.routeInlineText} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.keypadWrap}>
          {typeof children === "function" ? children(openPhotoPreview) : children}
        </View>

        <View
          style={[
            styles.footerWrap,
            {
              paddingBottom: dockPaddingBottom(insets.bottom, keyboardVisible, 12),
            },
          ]}
        >
          {footer}
        </View>
      </View>

      <Modal
        visible={previewOpen && hasAttachment}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewOpen(false)}>
          {attachment.uri ? (
            <Pressable onPress={() => setPreviewOpen(false)} style={styles.previewImageWrap}>
              <Image
                source={{ uri: attachment.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              {scanActive ? (
                <View style={styles.previewScanOverlay} pointerEvents="none">
                  <ExpenseBillScanOverlay visible scanTravel={120} label="Reading KM" />
                  {scanMessage ? (
                    <View style={styles.previewScanPill}>
                      <ActivityIndicator color="#6ee7b7" size="small" />
                      <Text style={styles.previewScanPillText} numberOfLines={2}>
                        {scanMessage}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.screenBackground,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  attachRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    minWidth: 0,
  },
  keypadWrap: {
    flex: 1,
    minHeight: 0,
  },
  footerWrap: {
    flexShrink: 0,
    paddingTop: 6,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewImageWrap: {
    width: "100%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewScanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  previewScanPill: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.35)",
  },
  previewScanPillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 15,
  },
});
