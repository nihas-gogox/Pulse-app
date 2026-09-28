import { HubPromoHeroLottie } from "@/components/hub/HubPromoLottie";
import Theme from "@/constants/Theme";
import { EMPTY_STATE_LOTTIE } from "@/lib/emptyStateLottieAssets";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

function useFloat(distance: number, duration: number) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [duration, value]);

  return value.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

export function NoTripsFoundEmpty({ compact = false }: { compact?: boolean }) {
  const width = compact ? 200 : 248;
  const height = compact ? 124 : 152;

  return (
    <View style={styles.tripWrap} accessibilityRole="text">
      <HubPromoHeroLottie source={EMPTY_STATE_LOTTIE.tripsTable} width={width} height={height} />
      <Text style={styles.tripTitle}>No trips found</Text>
      <Text style={styles.tripHint}>Try adjusting your filters or search for a different result.</Text>
    </View>
  );
}

export function NoDocumentPreviewEmpty({
  title,
  hint,
  compact = false,
}: {
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  const floatY = useFloat(compact ? 5 : 8, 2400);
  const driftY = useFloat(compact ? 4 : 7, 2800);
  const width = compact ? 220 : 300;
  const height = compact ? 150 : 196;

  return (
    <View style={styles.docWrap} accessibilityRole="text">
      <View style={[styles.docArt, { width, height }]}>
        <Animated.View style={[styles.docFloatLeft, compact && styles.docFloatLeftCompact, { transform: [{ translateY: driftY }, { rotate: "-8deg" }] }]}>
          <Svg width={compact ? 36 : 48} height={compact ? 44 : 58} viewBox="0 0 48 58">
            <Rect x="1" y="1" width="46" height="56" rx="6" fill={Theme.cardWhite} stroke={Theme.assignmentVehicleAccentBorder} />
            <Rect x="8" y="10" width="22" height="3" rx="1.5" fill={Theme.brandBluePressed} />
            <Rect x="8" y="18" width="30" height="3" rx="1.5" fill={Theme.complianceIconWash} />
            <Rect x="8" y="26" width="26" height="3" rx="1.5" fill={Theme.complianceIconWash} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.docFloatRight, compact && styles.docFloatRightCompact, { transform: [{ translateY: floatY }, { rotate: "10deg" }] }]}>
          <Svg width={compact ? 34 : 44} height={compact ? 42 : 54} viewBox="0 0 44 54">
            <Rect x="1" y="1" width="42" height="52" rx="6" fill={Theme.cardWhite} stroke={Theme.assignmentVehicleAccentBorder} />
            <Rect x="8" y="10" width="18" height="3" rx="1.5" fill={Theme.brandBluePressed} />
            <Rect x="8" y="18" width="26" height="3" rx="1.5" fill={Theme.complianceIconWash} />
            <Rect x="8" y="26" width="20" height="3" rx="1.5" fill={Theme.complianceIconWash} />
          </Svg>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: floatY }] }}>
          <Svg width={width} height={height} viewBox="0 0 300 196">
            <Ellipse cx="150" cy="108" rx="118" ry="62" fill={Theme.complianceIconWash} />
            <Path
              d="M28 118 C 52 78, 78 62, 108 86"
              stroke={Theme.complianceBulk}
              strokeWidth="1.6"
              strokeDasharray="4 5"
              fill="none"
              opacity={0.55}
            />
            <Path
              d="M214 64 C 246 42, 268 48, 286 34"
              stroke={Theme.complianceBulk}
              strokeWidth="1.6"
              strokeDasharray="4 5"
              fill="none"
              opacity={0.55}
            />
            <Path d="M286 34 l-8 2 l4 7 z" fill={Theme.complianceBulk} />
            <Rect x="92" y="78" width="132" height="86" rx="14" fill={Theme.complianceBulk} />
            <Path d="M92 96 h46 a12 12 0 0 0 12-12 V78 h-44 a14 14 0 0 0-14 14 z" fill={Theme.assignmentVehicleAccent} />
            <Rect x="108" y="58" width="78" height="46" rx="6" fill={Theme.cardWhite} />
            <Rect x="118" y="68" width="28" height="4" rx="2" fill={Theme.brandBluePressed} />
            <Circle cx="132" cy="84" r="5" fill={Theme.complianceIconWash} />
            <Rect x="118" y="92" width="52" height="3" rx="1.5" fill={Theme.complianceIconWash} />
            <Rect x="78" y="108" width="156" height="58" rx="12" fill={Theme.assignmentVehicleAccent} />
            <Rect x="108" y="96" width="72" height="58" rx="8" fill={Theme.cardWhite} stroke={Theme.assignmentVehicleAccentBorder} />
            <Rect x="118" y="106" width="22" height="16" rx="3" fill={Theme.complianceIconWash} />
            <Rect x="118" y="128" width="50" height="3" rx="1.5" fill={Theme.brandBluePressed} />
            <Rect x="118" y="136" width="38" height="3" rx="1.5" fill={Theme.complianceIconWash} />
            <Circle cx="214" cy="128" r="22" fill={Theme.cardWhite} stroke={Theme.buttonDark} strokeWidth="4" />
            <Line x1="206" y1="120" x2="222" y2="136" stroke={Theme.buttonDark} strokeWidth="2.4" strokeLinecap="round" />
            <Line x1="222" y1="120" x2="206" y2="136" stroke={Theme.buttonDark} strokeWidth="2.4" strokeLinecap="round" />
            <Line x1="230" y1="144" x2="248" y2="162" stroke={Theme.buttonDark} strokeWidth="5" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
      <Text style={[styles.docTitle, compact && styles.docTitleCompact]}>{title}</Text>
      {hint ? <Text style={styles.docHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tripWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "center",
  },
  tripHint: {
    maxWidth: 220,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    color: Theme.textMuted,
    textAlign: "center",
  },
  docWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  docArt: {
    alignItems: "center",
    justifyContent: "center",
  },
  docFloatLeft: {
    position: "absolute",
    left: 8,
    top: 28,
    zIndex: 2,
  },
  docFloatLeftCompact: { left: 0, top: 18 },
  docFloatRight: {
    position: "absolute",
    right: 6,
    top: 18,
    zIndex: 2,
  },
  docFloatRightCompact: { right: 0, top: 10 },
  docTitle: {
    marginTop: 2,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "center",
  },
  docTitleCompact: { fontSize: 18, lineHeight: 24 },
  docHint: {
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: Theme.textMuted,
    textAlign: "center",
  },
});
