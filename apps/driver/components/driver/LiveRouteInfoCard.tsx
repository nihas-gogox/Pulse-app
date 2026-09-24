/**
 * Floating “Live route” panel on the driver map — aligned with trip sheet card UI.
 * `compact`: single-row strip for the map controls row (left of +/-/locate).
 */
import { sheetStyles } from "./DriverTripSheetLayout";
import Theme from "@pulse/core/constants/Theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { Clock, Navigation, Sparkles } from "lucide-react-native";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type LiveRouteInfoThemeColors = {
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  emerald: string;
  emeraldMuted: string;
};

type Props = {
  colors: LiveRouteInfoThemeColors;
  /** e.g. pickup / destination */
  toLabel: string;
  distanceDisplay: string | null;
  etaDisplay: string;
  arrivalClock: string | null;
  bottomHint?: string;
  /** Inline strip for the map top controls row (left of zoom / locate). */
  compact?: boolean;
};

const EMERALD = Theme.driverEmerald;
const EMERALD_DARK = Theme.driverEmeraldDark;
const MINT = "rgba(167,243,208,0.92)";

export function LiveRouteInfoCard({
  colors,
  toLabel,
  distanceDisplay,
  etaDisplay,
  arrivalClock,
  bottomHint,
  compact = false,
}: Props) {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.42, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const dist = distanceDisplay ?? "—";

  if (compact) {
    const toShort =
      toLabel === "destination" ? "drop" : toLabel === "pickup" ? "pickup" : toLabel;
    return (
      <View style={styles.compactShell}>
        <LinearGradient
          colors={[EMERALD_DARK, EMERALD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.compactGradient}
        >
          <View style={styles.compactEyebrowRow}>
            <Sparkles size={7} color={MINT} strokeWidth={2.5} />
            <Text style={styles.compactEyebrow} numberOfLines={1}>
              LIVE
            </Text>
            <Text style={styles.compactTo} numberOfLines={1}>
              · {toShort}
            </Text>
            <Reanimated.View style={[styles.liveDot, styles.liveDotOnDark, pulseStyle]} />
          </View>

          <View style={styles.compactStats}>
            <View style={styles.compactStat}>
              <Navigation size={8} color={MINT} strokeWidth={2.4} />
              <Text
                style={styles.compactStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {dist}
              </Text>
            </View>
            <View style={styles.compactStatDiv} />
            <View style={styles.compactStat}>
              <Clock size={8} color={MINT} strokeWidth={2.4} />
              <Text
                style={styles.compactStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {etaDisplay}
              </Text>
            </View>
            {arrivalClock ? (
              <>
                <View style={styles.compactStatDiv} />
                <View style={[styles.compactStat, styles.compactStatArrival]}>
                  <FontAwesome name="flag-checkered" size={7} color={MINT} />
                  <Text
                    style={styles.compactStatValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ~{arrivalClock}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <LinearGradient
        colors={[EMERALD_DARK, EMERALD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroEyebrowRow}>
          <Sparkles size={8} color={MINT} strokeWidth={2.5} />
          <Text style={styles.heroEyebrow}>LIVE ROUTE</Text>
        </View>
        <Text style={styles.heroSubtitle} numberOfLines={1}>
          Remaining to {toLabel}
        </Text>
      </LinearGradient>

      <View style={[styles.body, { backgroundColor: colors.surface }]}>
        <View style={sheetStyles.tripDetailsCard}>
          <View style={sheetStyles.statsInline}>
            <View style={sheetStyles.statChip}>
              <Navigation size={10} color={EMERALD} strokeWidth={2.2} />
              <Text style={[sheetStyles.statValue, { color: colors.text }]}>
                {dist}
              </Text>
            </View>
            <View style={sheetStyles.statDivider} />
            <View style={sheetStyles.statChip}>
              <Clock size={10} color={EMERALD} strokeWidth={2.2} />
              <Text style={[sheetStyles.statValue, { color: colors.text }]}>
                {etaDisplay}
              </Text>
            </View>
          </View>
          {arrivalClock ? (
            <>
              <View style={sheetStyles.tripDetailsDivider} />
              <View style={styles.arrivalRow}>
                <FontAwesome name="flag-checkered" size={10} color={EMERALD} />
                <Text style={[styles.arrivalText, { color: EMERALD }]} numberOfLines={1}>
                  Arrive ~{arrivalClock}
                </Text>
                <Reanimated.View style={[styles.liveDot, pulseStyle]} />
              </View>
            </>
          ) : null}
        </View>
        {bottomHint ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{bottomHint}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.border,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        }
      : { elevation: 4 }),
  },
  compactShell: {
    flex: 1,
    minWidth: 0,
    height: 32,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }
      : { elevation: 2 }),
  },
  compactGradient: {
    flex: 1,
    height: 32,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "38%",
  },
  compactEyebrow: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: MINT,
    flexShrink: 0,
  },
  compactTo: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: -0.1,
    flexShrink: 1,
    minWidth: 0,
  },
  compactStats: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  compactStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  compactStatArrival: {
    maxWidth: 52,
    flexShrink: 1,
  },
  compactStatValue: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.2,
    flexShrink: 1,
    minWidth: 0,
  },
  compactStatDiv: {
    width: StyleSheet.hairlineWidth,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.32)",
    flexShrink: 0,
  },
  compactHint: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 0.1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  hero: {
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 4,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: MINT,
    textTransform: "uppercase",
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 14,
    paddingLeft: 18,
  },
  body: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 5,
  },
  arrivalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  arrivalText: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMERALD,
  },
  liveDotOnDark: {
    backgroundColor: MINT,
    width: 4,
    height: 4,
    borderRadius: 2,
    flexShrink: 0,
  },
  hint: {
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 12,
    paddingHorizontal: 2,
  },
});
