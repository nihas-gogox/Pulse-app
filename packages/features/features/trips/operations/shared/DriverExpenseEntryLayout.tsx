import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "@pulse/core/constants/Layout";
import Theme from "@pulse/core/constants/Theme";
import Typography from "@pulse/core/constants/Typography";
import { getDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";
import { useKeyboardVisible } from "@pulse/core/lib/hooks/useKeyboardVisible";

import { ExpenseBillScanBanner } from "./ExpenseBillScanBanner";
import { ExpenseBillScanOverlay } from "./ExpenseBillScanOverlay";
import { OpsEntryBodyPhotoSlot } from "./OpsEntryBodyPhotoSlot";
import {
  DriverOpsEntryIcon,
  driverOpsEntryStyles as ops,
} from "@pulse/domain/features/trips/operations/shared/driverOpsEntry.styles";
import type { BillScanState } from "@pulse/domain/features/trips/operations/shared/expenseBillScan.types";

const FOOTER_HEIGHT = 72;

type ScrollAssistContextValue = {
  scrollToInput: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
};

const ScrollAssistContext = createContext<ScrollAssistContextValue | null>(null);

export type DriverExpenseCategory = "fuel" | "toll" | "other";

type CategoryConfig = {
  icon: ComponentProps<typeof Feather>["name"];
  kicker: string;
  hint: string;
};

const CATEGORY: Record<DriverExpenseCategory, CategoryConfig> = {
  fuel: {
    icon: "droplet",
    kicker: "Fuel expense",
    hint: "Log fuel you paid out of pocket for fleet reimbursement.",
  },
  toll: {
    icon: "map-pin",
    kicker: "Toll expense",
    hint: "Log toll or FASTag costs you paid during this trip.",
  },
  other: {
    icon: "plus-circle",
    kicker: "Other expense",
    hint: "Parking, loading, detention, and other trip costs.",
  },
};

type AttachmentProps = {
  uri: string | null;
  busy?: boolean;
  onAttach: () => void;
  onRemove?: () => void;
  /** e.g. "Bill photo" / "Receipt" */
  label?: string;
};

type Props = {
  category: DriverExpenseCategory;
  title: string;
  subtitle: string;
  isEditing: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  /** When true, primary save stays disabled (e.g. amount still empty). */
  saveDisabled?: boolean;
  skipLabel?: string;
  hint?: string | null;
  syncHint?: string | null;
  billScan?: BillScanState | null;
  onApplyBillScan?: () => void;
  onDismissBillScan?: () => void;
  onReviewBillScan?: () => void;
  attachment?: AttachmentProps;
  /**
   * Amount field rendered beside the receipt slot (same row).
   * Prefer this over a separate Amount section for a compact expense header.
   */
  amountSlot?: ReactNode;
  children: ReactNode;
};

export function DriverExpenseEntryLayout({
  category,
  title,
  subtitle,
  isEditing,
  saving,
  onBack,
  onSave,
  saveDisabled = false,
  skipLabel = "Cancel",
  hint,
  syncHint,
  billScan,
  onApplyBillScan,
  onDismissBillScan,
  onReviewBillScan,
  attachment,
  amountSlot,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = getDriverThemeColors("light");
  const meta = CATEGORY[category];
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasAttachment = !!attachment?.uri?.trim();
  const scanActive = billScan?.phase === "preparing" || billScan?.phase === "analyzing";
  const scrollRef = useRef<ScrollView>(null);
  const { keyboardVisible, keyboardHeight } = useKeyboardVisible();

  const scrollToInput = useCallback((event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    const target = event.nativeEvent.target;
    if (target == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        target,
        FOOTER_HEIGHT + 24,
        true,
      );
    });
  }, []);

  const scrollPaddingBottom =
    FOOTER_HEIGHT +
    20 +
    (keyboardVisible
      ? Platform.OS === "ios"
        ? 12
        : Math.max(keyboardHeight, 240) + 12
      : insets.bottom);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled={Platform.OS !== "web"}
    >
      <View style={styles.body}>
      <View
        style={[
          ops.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.emeraldDark,
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

          {attachment ? (
            <View style={ops.attachCluster}>
              {hasAttachment ? (
                <>
                  <Pressable
                    style={[
                      ops.attachThumbBtn,
                      scanActive && ops.attachThumbBtnScanning,
                    ]}
                    onPress={() => setPreviewOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="View attached bill photo"
                  >
                    <Image source={{ uri: attachment.uri! }} style={ops.attachThumb} resizeMode="cover" />
                    <ExpenseBillScanOverlay visible={!!scanActive} />
                  </Pressable>
                  {attachment.onRemove ? (
                    <Pressable
                      style={ops.attachRemoveBtn}
                      onPress={attachment.onRemove}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Remove bill photo"
                    >
                      <Feather name="x" size={DriverOpsEntryIcon.headerThumb} color="#fff" />
                    </Pressable>
                  ) : null}
                </>
              ) : null}
              <Pressable
                style={[ops.attachBtn, hasAttachment && ops.attachBtnSecondary]}
                onPress={attachment.onAttach}
                disabled={attachment.busy || saving}
                accessibilityRole="button"
                accessibilityLabel={hasAttachment ? "Retake bill photo" : "Attach bill photo"}
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
                      {hasAttachment ? "Retake" : "Attach bill"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={ops.heroRow}>
          <View style={ops.heroIcon}>
            <Feather name={meta.icon} size={DriverOpsEntryIcon.hero} color={colors.emeraldDark} />
          </View>
          <View style={ops.heroCopy}>
            <Text style={ops.heroKicker}>{meta.kicker}</Text>
            <Text style={ops.heroTitle}>{title}</Text>
            <View style={ops.routeInline}>
              <Feather name="navigation" size={9} color="rgba(255,255,255,0.8)" />
              <Text style={ops.routeInlineText} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
        </View>
        <Text style={ops.heroHint} numberOfLines={2}>
          {meta.hint}
        </Text>
      </View>

      <Modal
        visible={previewOpen && hasAttachment}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewOpen(false)}>
          {attachment?.uri ? (
            <Pressable onPress={() => setPreviewOpen(false)} style={styles.previewImageWrap}>
              <Image
                source={{ uri: attachment.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              {scanActive ? (
                <View style={styles.previewScanOverlay} pointerEvents="none">
                  <ExpenseBillScanOverlay visible scanTravel={120} label="AI scan" />
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[ops.content, { paddingBottom: scrollPaddingBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <ScrollAssistContext.Provider value={{ scrollToInput }}>
          {attachment || amountSlot ? (
            attachment && amountSlot ? (
              <View
                style={[
                  styles.receiptAmountCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.receiptAmountRow}>
                  <View style={[styles.receiptCol, styles.receiptColSplit]}>
                    <OpsEntryBodyPhotoSlot
                      uri={attachment.uri ?? null}
                      title={attachment.label ?? "Bill photo"}
                      emptyTitle={attachment.label ?? "Bill photo"}
                      hint={
                        billScan?.phase === "confirm"
                          ? "Review detected fields below · confirm to fill form"
                          : "Tap image to enlarge · AI fills fields when detected"
                      }
                      emptyHint="Photo auto-fills fields"
                      scanning={!!scanActive}
                      busy={attachment.busy || saving}
                      scanLabel="AI scan"
                      compact
                      embedded
                      onAttach={attachment.onAttach}
                      onPress={hasAttachment ? () => setPreviewOpen(true) : undefined}
                      onRetake={attachment.onAttach}
                      onRemove={attachment.onRemove}
                    />
                  </View>
                  <View style={styles.receiptAmountDivider} />
                  <View style={[styles.amountCol, styles.amountColSplit]}>
                    <Text style={[styles.inlineSectionTitle, { color: colors.textMuted }]}>
                      Amount
                    </Text>
                    <View style={styles.amountBody}>{amountSlot}</View>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.receiptAmountRow,
                  !attachment || !amountSlot ? styles.receiptAmountRowSolo : null,
                ]}
              >
                {attachment ? (
                  <View style={[styles.receiptCol, styles.receiptColFull]}>
                    <OpsEntryBodyPhotoSlot
                      uri={attachment.uri ?? null}
                      title={attachment.label ?? "Bill photo"}
                      emptyTitle={attachment.label ?? "Bill photo"}
                      hint={
                        billScan?.phase === "confirm"
                          ? "Review detected fields below · confirm to fill form"
                          : "Tap image to enlarge · AI fills fields when detected"
                      }
                      emptyHint="Photo auto-fills fields"
                      scanning={!!scanActive}
                      busy={attachment.busy || saving}
                      scanLabel="AI scan"
                      onAttach={attachment.onAttach}
                      onPress={hasAttachment ? () => setPreviewOpen(true) : undefined}
                      onRetake={attachment.onAttach}
                      onRemove={attachment.onRemove}
                    />
                  </View>
                ) : null}
                {amountSlot ? (
                  <View style={[styles.amountCol, styles.amountColFull]}>
                    <DriverExpenseSection title="Amount">{amountSlot}</DriverExpenseSection>
                  </View>
                ) : null}
              </View>
            )
          ) : null}
          {billScan && billScan.phase !== "idle" ? (
            <ExpenseBillScanBanner
              scan={billScan}
              onApplyPending={onApplyBillScan}
              onDismissPending={onDismissBillScan}
              onReviewOcr={onReviewBillScan}
            />
          ) : null}
          {children}
        </ScrollAssistContext.Provider>

        {hint ? (
          <View style={[ops.notice, { backgroundColor: colors.emeraldMuted, borderColor: colors.emeraldBorderSoft }]}>
            <Feather name="info" size={DriverOpsEntryIcon.notice} color={colors.emeraldDark} />
            <Text style={[ops.noticeText, { color: colors.emeraldDark }]}>{hint}</Text>
          </View>
        ) : null}
        {syncHint ? (
          <Text style={[ops.syncHint, { color: colors.textMuted }]}>{syncHint}</Text>
        ) : null}
      </ScrollView>

      <View
        style={[
          ops.footer,
          {
            paddingHorizontal: Layout.screenPaddingHorizontal,
            paddingTop: 8,
            paddingBottom: keyboardVisible ? 8 : insets.bottom + 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[ops.skipBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={onBack}
          disabled={saving}
        >
          <Text style={[ops.skipText, { color: colors.textMuted }]}>{skipLabel}</Text>
        </Pressable>
        <Pressable
          style={[
            ops.saveBtn,
            { backgroundColor: colors.emeraldDark },
            (saving || saveDisabled) && { opacity: 0.5 },
          ]}
          onPress={onSave}
          disabled={saving || saveDisabled}
          accessibilityState={{ disabled: saving || saveDisabled }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={ops.saveText}>
              {isEditing ? "Update expense" : "Save expense"}
            </Text>
          )}
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function DriverExpenseSection({
  title,
  children,
  fill,
}: {
  title?: string;
  children: ReactNode;
  /** Stretch to match sibling height (receipt + amount row). */
  fill?: boolean;
}) {
  const colors = getDriverThemeColors("light");
  return (
    <View
      style={[
        ops.section,
        fill && styles.sectionFill,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {title ? (
        <View style={ops.sectionHeader}>
          <Text style={[ops.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
        </View>
      ) : null}
      <View style={[ops.sectionBody, fill && styles.sectionBodyFill]}>{children}</View>
    </View>
  );
}

export function DriverExpenseFieldLabel({ children }: { children: string }) {
  const colors = getDriverThemeColors("light");
  return <Text style={[ops.fieldLabel, { color: colors.textMuted }]}>{children}</Text>;
}

export function DriverExpenseFieldDivider() {
  return <View style={ops.fieldDivider} />;
}

export function DriverExpenseTextInput(
  props: React.ComponentProps<typeof TextInput> & { multiline?: boolean },
) {
  const colors = getDriverThemeColors("light");
  const scrollAssist = useContext(ScrollAssistContext);
  const { onFocus, ...rest } = props;

  return (
    <TextInput
      {...rest}
      placeholderTextColor={colors.placeholder}
      onFocus={(event) => {
        scrollAssist?.scrollToInput(
          event as unknown as NativeSyntheticEvent<TextInputFocusEventData>,
        );
        onFocus?.(event);
      }}
      style={[
        ops.input,
        props.multiline && ops.inputMultiline,
        {
          color: colors.text,
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  receiptAmountRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
  },
  receiptAmountRowSolo: {
    flexDirection: "column",
    gap: 10,
  },
  receiptAmountCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  receiptAmountDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: Theme.borderLight,
    marginHorizontal: 10,
  },
  receiptCol: {
    minWidth: 0,
  },
  receiptColSplit: {
    flex: 0.92,
    alignSelf: "stretch",
  },
  receiptColFull: {
    width: "100%",
  },
  amountCol: {
    minWidth: 0,
    justifyContent: "flex-start",
    alignSelf: "stretch",
  },
  amountColSplit: {
    flex: 1.08,
    gap: 6,
  },
  amountColFull: {
    width: "100%",
  },
  amountBody: {
    flex: 1,
    justifyContent: "center",
  },
  inlineSectionTitle: {
    ...Typography.headerTitle,
    fontSize: 9,
    letterSpacing: 0.55,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionFill: {
    flex: 1,
    minHeight: 0,
  },
  sectionBodyFill: {
    flex: 1,
    justifyContent: "center",
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
});
