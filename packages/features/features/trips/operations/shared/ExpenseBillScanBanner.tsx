import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Theme from "@pulse/core/constants/Theme";
import Typography from "@pulse/core/constants/Typography";
import { getDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";
import { DriverOpsEntryIcon } from "@pulse/domain/features/trips/operations/shared/driverOpsEntry.styles";

import { BILL_SCAN_PIPELINE_STEPS } from "@pulse/domain/features/trips/operations/shared/expenseBillScan.constants";
import type { BillScanState } from "@pulse/domain/features/trips/operations/shared/expenseBillScan.types";

type Props = {
  scan: BillScanState;
  onApplyPending?: () => void;
  onDismissPending?: () => void;
  onReviewOcr?: () => void;
};

function PipelineStep({
  label,
  index,
  activeIndex,
  accent,
  muted,
  complete,
}: {
  label: string;
  index: number;
  activeIndex: number;
  accent: string;
  muted: string;
  complete: boolean;
}) {
  const isActive = index === activeIndex;
  const isDone = complete || index < activeIndex;

  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepDot,
          isDone && { backgroundColor: accent, borderColor: accent },
          isActive && !isDone && { borderColor: accent, backgroundColor: `${accent}22` },
          !isActive && !isDone && { borderColor: muted, backgroundColor: "transparent" },
        ]}
      >
        {isDone ? (
          <Feather name="check" size={8} color="#fff" />
        ) : isActive ? (
          <View style={[styles.stepDotPulse, { backgroundColor: accent }]} />
        ) : null}
      </View>
      <Text
        style={[
          styles.stepLabel,
          { color: isDone || isActive ? accent : muted },
          isActive && styles.stepLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ExpenseBillScanBanner({ scan, onApplyPending, onDismissPending, onReviewOcr }: Props) {
  const colors = getDriverThemeColors("light");
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const glow = useSharedValue(0);

  const isAnalyzing = scan.phase === "analyzing" || scan.phase === "preparing";
  const isComplete = scan.phase === "complete";
  const isConfirm = scan.phase === "confirm";
  const isError = scan.phase === "error";
  const hasPendingUpdates = (scan.pendingUpdates?.length ?? 0) > 0 && isConfirm;
  const appliedOcrUpdates = scan.appliedOcrUpdates ?? [];
  const showAppliedUpdates = isComplete && appliedOcrUpdates.length > 0;
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
      ring.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
      shimmer.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
      return;
    }

    pulse.value = withTiming(0, { duration: 200 });
    ring.value = withTiming(0, { duration: 200 });
    shimmer.value = withTiming(isComplete ? 1 : 0, { duration: 300 });

    if (isComplete) {
      glow.value = withSequence(
        withSpring(1, { damping: 12, stiffness: 180 }),
        withDelay(1200, withTiming(0.35, { duration: 600 })),
      );
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [glow, isAnalyzing, isComplete, pulse, ring, scan.phase, shimmer]);

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.06]) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.95]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [0.92, 1.08]) },
      { rotate: `${interpolate(ring.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(12, shimmer.value * 100)}%`,
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.65, 1, 0.65]),
  }));

  const bannerGlowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
  }));

  if (scan.phase === "idle" || !scan.message.trim()) return null;

  const iconName = isError ? "alert-circle" : isConfirm ? "help-circle" : isComplete ? "check-circle" : "aperture";
  const accent = isError ? Theme.warning : isConfirm ? Theme.primary : colors.emeraldDark;
  const bg = isError
    ? "rgba(245, 158, 11, 0.1)"
    : isConfirm
      ? "rgba(99,102,241,0.1)"
      : colors.emeraldMuted;
  const border = isError
    ? "rgba(245, 158, 11, 0.35)"
    : isConfirm
      ? "rgba(99,102,241,0.32)"
      : colors.emeraldBorderSoft;

  return (
    <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.wrapper}>
      <Animated.View style={[styles.glow, { backgroundColor: accent }, bannerGlowStyle]} />
      <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
        {isAnalyzing ? (
          <LinearGradient
            colors={[`${accent}00`, `${accent}33`, `${accent}00`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topShimmer}
          />
        ) : null}

        <View style={styles.mainRow}>
          <View style={styles.iconColumn}>
            <Animated.View style={[styles.iconRing, { borderColor: `${accent}55` }, ringStyle]} />
            <Animated.View style={[styles.iconWrap, { backgroundColor: `${accent}18` }, iconWrapStyle]}>
              <Feather name={iconName} size={DriverOpsEntryIcon.scanBanner} color={accent} />
            </Animated.View>
          </View>

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: accent }]}>
                {isAnalyzing
                  ? "AI receipt intelligence"
                  : isConfirm
                    ? "Confirm bill updates"
                    : showAppliedUpdates
                      ? "OCR fields applied"
                      : isComplete
                        ? "Fields captured"
                        : "Scan notice"}
              </Text>
              {scan.processingSec != null && scan.processingSec > 0 ? (
                <View style={[styles.timingPill, { backgroundColor: `${accent}14` }]}>
                  <Feather name="clock" size={9} color={accent} />
                  <Text style={[styles.timing, { color: accent }]}>
                    {scan.processingSec.toFixed(1)}s
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.message, { color: colors.textMuted }]}>{scan.message}</Text>

            {isAnalyzing || isComplete ? (
              <View style={styles.pipelineRow}>
                {BILL_SCAN_PIPELINE_STEPS.map((step, index) => (
                  <PipelineStep
                    key={step.id}
                    label={step.label}
                    index={index}
                    activeIndex={activeStep}
                    accent={accent}
                    muted={colors.textMuted}
                    complete={isComplete}
                  />
                ))}
              </View>
            ) : null}

            {isAnalyzing ? (
              <View style={[styles.progressTrack, { backgroundColor: `${accent}18` }]}>
                <Animated.View style={[styles.progressFill, { backgroundColor: accent }, barFillStyle]} />
              </View>
            ) : null}

            {hasPendingUpdates || showAppliedUpdates ? (
              <View style={styles.updatesList}>
                {(hasPendingUpdates ? scan.pendingUpdates! : appliedOcrUpdates).map((update) => (
                  <View
                    key={update.id}
                    style={[styles.updateRow, { borderColor: border, backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.updateLabel, { color: colors.textMuted }]}>{update.label}</Text>
                    <View style={styles.updateValues}>
                      {hasPendingUpdates ? (
                        <>
                          <Text style={[styles.updateFrom, { color: colors.textMuted }]} numberOfLines={1}>
                            {update.fromDisplay}
                          </Text>
                          <Feather name="arrow-right" size={10} color={accent} />
                        </>
                      ) : null}
                      <Text style={[styles.updateTo, { color: colors.text }]} numberOfLines={2}>
                        {update.toDisplay}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {showAppliedUpdates ? (
              <View style={styles.confirmRow}>
                <Pressable
                  style={[styles.confirmBtn, styles.confirmBtnGhost, { borderColor: border }]}
                  onPress={() => onReviewOcr?.()}
                  accessibilityRole="button"
                  accessibilityLabel="Review and edit OCR fills"
                >
                  <Feather name="edit-3" size={11} color={accent} />
                  <Text style={[styles.confirmBtnGhostText, { color: colors.textMuted }]}>
                    Review & edit OCR fills
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {hasPendingUpdates ? (
              <View style={styles.confirmRow}>
                <Pressable
                  style={[styles.confirmBtn, styles.confirmBtnPrimary, { backgroundColor: accent }]}
                  onPress={() => onApplyPending?.()}
                  accessibilityRole="button"
                  accessibilityLabel="Apply bill scan updates"
                >
                  <Feather name="check" size={11} color="#fff" />
                  <Text style={styles.confirmBtnPrimaryText}>
                    Apply {scan.pendingUpdates!.length === 1 ? "update" : "updates"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, styles.confirmBtnGhost, { borderColor: border }]}
                  onPress={() => onDismissPending?.()}
                  accessibilityRole="button"
                  accessibilityLabel="Skip OCR fills and keep manual entry"
                >
                  <Text style={[styles.confirmBtnGhostText, { color: colors.textMuted }]}>Skip OCR fills</Text>
                </Pressable>
              </View>
            ) : null}

            {!showAppliedUpdates && scan.appliedFields.length > 0 ? (
              <View style={styles.chipRow}>
                {scan.appliedFields.map((field, index) => (
                  <Animated.View
                    key={field}
                    entering={FadeInDown.delay(index * 70).springify().damping(16)}
                  >
                    <View
                      style={[styles.chip, { backgroundColor: colors.surface, borderColor: border }]}
                    >
                      <Feather name="check" size={10} color={accent} />
                      <Text style={[styles.chipText, { color: colors.textMuted }]}>{field}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    transform: [{ scale: 1.02 }],
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Theme.driverEmeraldDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  topShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  iconColumn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
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
    gap: 8,
  },
  title: {
    ...Typography.headerTitle,
    fontSize: 9,
    letterSpacing: 0.65,
  },
  timingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  timing: {
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  message: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  stepLabelActive: {
    fontWeight: "800",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  updatesList: {
    gap: 6,
  },
  updateRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  updateLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  updateValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  updateFrom: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    minWidth: 0,
  },
  updateTo: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    minWidth: 0,
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
});
