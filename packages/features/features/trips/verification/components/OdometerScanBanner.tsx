import Feather from "@expo/vector-icons/Feather";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import Theme from "@pulse/core/constants/Theme";
import Typography from "@pulse/core/constants/Typography";
import { DriverOpsEntryIcon } from "@pulse/domain/features/trips/operations/shared/driverOpsEntry.styles";

import type { OdometerScanState } from "@pulse/domain/features/trips/verification/odometerScan.types";

const PIPELINE = ["Photo", "Read", "Extract", "Apply"] as const;

type Props = {
  scan: OdometerScanState;
  hasPhoto?: boolean;
  onApplyPending?: () => void;
  onDismissPending?: () => void;
  onRescanPhoto?: () => void;
  onReviewOcr?: () => void;
};

export function OdometerScanBanner({
  scan,
  hasPhoto = false,
  onApplyPending,
  onDismissPending,
  onRescanPhoto,
  onReviewOcr,
}: Props) {
  const pulse = useSharedValue(0);
  const progress = useSharedValue(0);

  const isAnalyzing = scan.phase === "analyzing" || scan.phase === "preparing";
  const isComplete = scan.phase === "complete";
  const isConfirm = scan.phase === "confirm";
  const isError = scan.phase === "error";
  const hasPendingApply = Boolean(scan.pendingKm?.trim()) && (isConfirm || scan.phase === "complete");
  const detectedKm = scan.detectedKm?.trim() || null;
  const showDetectedKm = Boolean(detectedKm) && !isAnalyzing && !isError;
  const showRescanActions =
    Boolean(onRescanPhoto) &&
    !isAnalyzing &&
    !isError &&
    (showDetectedKm || hasPhoto) &&
    !hasPendingApply;

  const statusTitle = isAnalyzing
    ? "AI odometer scan"
    : isConfirm
      ? "Confirm reading"
      : isComplete
        ? "Scan complete"
        : "Scan notice";

  /** Photo attached, no OCR yet — icon + title + re-scan in one row. */
  const isCompactRow =
    showRescanActions &&
    hasPhoto &&
    !showDetectedKm &&
    !hasPendingApply &&
    !isAnalyzing &&
    !(scan.appliedFields?.length) &&
    !isConfirm;

  const activeStep = scan.stepIndex ?? (scan.phase === "preparing" ? 0 : isComplete || isConfirm ? 3 : 1);

  useEffect(() => {
    if (isAnalyzing) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      progress.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }
    pulse.value = withTiming(isComplete || isConfirm ? 1 : 0, { duration: 220 });
    progress.value = withTiming(isComplete || isConfirm ? 1 : 0, { duration: 280 });
  }, [isAnalyzing, isComplete, isConfirm, progress, pulse, scan.phase]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.06]) }],
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(12, progress.value * 100)}%`,
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.65, 1, 0.65]),
  }));

  if (scan.phase === "idle" || !scan.message.trim()) return null;

  const accent = isError ? Theme.warning : isConfirm ? Theme.primary : Theme.driverEmeraldDark;
  const bg = isError
    ? "rgba(245,158,11,0.1)"
    : isConfirm
      ? "rgba(99,102,241,0.1)"
      : "rgba(16,185,129,0.1)";
  const border = isError
    ? "rgba(245,158,11,0.35)"
    : isConfirm
      ? "rgba(99,102,241,0.32)"
      : "rgba(16,185,129,0.28)";

  const iconName = isError
    ? "alert-circle"
    : isConfirm
      ? "help-circle"
      : isComplete
        ? "check-circle"
        : "aperture";

  if (isCompactRow) {
    return (
      <Animated.View
        entering={FadeInDown.duration(260).springify()}
        style={[styles.banner, styles.bannerCompact, { backgroundColor: bg, borderColor: border }]}
      >
        <Animated.View style={[styles.iconWrapCompact, { backgroundColor: `${accent}18` }, iconWrapStyle]}>
          <Feather name={iconName} size={12} color={accent} />
        </Animated.View>
        <Text style={[styles.titleCompact, { color: accent }]} numberOfLines={1}>
          {statusTitle}
        </Text>
        <Pressable
          style={[styles.rescanBtn, { backgroundColor: accent }]}
          onPress={() => onRescanPhoto?.()}
          accessibilityRole="button"
          accessibilityLabel="Re-run OCR on attached photo"
        >
          <Feather name="refresh-cw" size={9} color="#fff" />
          <Text style={styles.rescanBtnText}>Re-scan</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(260).springify()} style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      <Animated.View style={[styles.iconWrap, { backgroundColor: `${accent}18` }, iconWrapStyle]}>
        <Feather name={iconName} size={DriverOpsEntryIcon.scanBanner} color={accent} />
      </Animated.View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
            {statusTitle}
          </Text>
          <View style={styles.titleActions}>
            {showRescanActions ? (
              <Pressable
                style={[styles.rescanBtn, { backgroundColor: accent }]}
                onPress={() => onRescanPhoto?.()}
                accessibilityRole="button"
                accessibilityLabel="Re-run OCR on attached photo"
              >
                <Feather name="refresh-cw" size={9} color="#fff" />
                <Text style={styles.rescanBtnText}>Re-scan</Text>
              </Pressable>
            ) : null}
            {scan.processingSec != null && scan.processingSec > 0 ? (
              <Text style={[styles.timing, { color: Theme.textMuted }]}>
                {scan.processingSec.toFixed(1)}s
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.message, { color: Theme.textSecondary }]}>{scan.message}</Text>

        {showDetectedKm ? (
          <View style={[styles.detectedRow, { borderColor: border }]}>
            <Text style={[styles.detectedLabel, { color: Theme.textMuted }]}>OCR reading</Text>
            <Text style={[styles.detectedValue, { color: Theme.textPrimaryDark }]}>{detectedKm} KM</Text>
          </View>
        ) : null}

        {isAnalyzing ? (
          <>
            <View style={styles.pipelineRow}>
              {PIPELINE.map((label, index) => (
                <View key={label} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      (index <= activeStep || isComplete) && {
                        backgroundColor: accent,
                        borderColor: accent,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: index <= activeStep ? accent : Theme.textMuted },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.progressTrack, { backgroundColor: `${accent}18` }]}>
              <Animated.View style={[styles.progressFill, { backgroundColor: accent }, barFillStyle]} />
            </View>
          </>
        ) : null}

        {hasPendingApply && scan.pendingKm ? (
          <View style={styles.confirmRow}>
            <Pressable
              style={[styles.confirmBtn, styles.confirmBtnPrimary, { backgroundColor: accent }]}
              onPress={() => onApplyPending?.()}
              accessibilityRole="button"
              accessibilityLabel={`Apply ${scan.pendingKm} KM`}
            >
              <Feather name="check" size={11} color="#fff" />
              <Text style={styles.confirmBtnPrimaryText}>Apply {scan.pendingKm} KM</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, styles.confirmBtnGhost, { borderColor: border }]}
              onPress={() => onDismissPending?.()}
              accessibilityRole="button"
              accessibilityLabel="Keep current reading"
            >
              <Text style={[styles.confirmBtnGhostText, { color: Theme.textSecondary }]}>Keep current</Text>
            </Pressable>
          </View>
        ) : null}

        {showRescanActions && showDetectedKm && onReviewOcr ? (
          <View style={styles.inlineActionRow}>
            <Pressable
              style={[styles.reviewBtn, { borderColor: border }]}
              onPress={() => onReviewOcr()}
              accessibilityRole="button"
              accessibilityLabel="Review OCR reading"
            >
              <Feather name="edit-3" size={9} color={accent} />
              <Text style={[styles.reviewBtnText, { color: Theme.textSecondary }]}>Review reading</Text>
            </Pressable>
          </View>
        ) : null}

        {scan.appliedFields && scan.appliedFields.length > 0 ? (
          <View style={styles.chipRow}>
            {scan.appliedFields.map((field) => (
              <View key={field} style={[styles.chip, { borderColor: border }]}>
                <Feather name="check" size={10} color={accent} />
                <Text style={[styles.chipText, { color: Theme.textSecondary }]}>{field}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    ...Platform.select({
      ios: {
        shadowColor: Theme.driverEmeraldDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  bannerCompact: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  iconWrapCompact: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleCompact: {
    ...Typography.headerTitle,
    fontSize: 9,
    letterSpacing: 0.6,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minHeight: 22,
  },
  title: {
    ...Typography.headerTitle,
    fontSize: 9,
    letterSpacing: 0.6,
    flex: 1,
    minWidth: 0,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    minHeight: 22,
  },
  rescanBtnText: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.buttonPrimaryText,
    letterSpacing: 0.15,
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: Theme.cardWhite,
    minHeight: 24,
  },
  reviewBtnText: {
    fontSize: 9,
    fontWeight: "700",
  },
  timing: {
    fontSize: 9,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  message: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  detectedRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: Theme.cardWhite,
  },
  detectedLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  detectedValue: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  pipelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Theme.borderLight,
    backgroundColor: "transparent",
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  confirmRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
  },
  confirmBtnPrimary: {},
  confirmBtnPrimaryText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  confirmBtnGhost: {
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
  },
  confirmBtnGhostText: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Theme.cardWhite,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
