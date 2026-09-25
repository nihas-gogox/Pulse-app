/**
 * Load story preview — single elegant card with entrance motion + Lottie hero.
 */
import { HubPromoHeroLottie } from "@pulse/ui/components/hub/HubPromoLottie";
import Layout from "@pulse/core/constants/Layout";
import Theme from "@pulse/core/constants/Theme";
import { RouteEndpointStack } from "./RouteEndpointStack";
import type { PostRow } from "@pulse/domain/features/network/services/posts.service";
import { formatINR } from "@pulse/core/lib/format";
import { ArrowRight, Package } from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";

const INK = Theme.loadAddButtonText;
const MUTED = Theme.loadStatusTabTextMuted;
const SKY = Theme.loadAddButtonBg;
const SKY_TRAY = Theme.loadStatusTabTrayBg;

const LOAD_BROADCAST_LOTTIE = require("@/assets/Animated folder/auction.json");
const OPEN_CAPACITY_LOTTIE = require("@/assets/Animated folder/truck.json");

export type StoryBroadcastPreviewProps = {
  post: PostRow;
  loadMaterial: string;
  origin: string | null | undefined;
  destination: string | null | undefined;
  loadTargetRate: number | null;
  isDesktopPreview?: boolean;
  storyKey: string;
  /** Defaults to "Load broadcast". FO capacity uses "Open capacity". */
  kicker?: string;
};

export function StoryBroadcastPreview({
  post,
  loadMaterial,
  origin,
  destination,
  loadTargetRate,
  isDesktopPreview = false,
  storyKey,
  kicker = "Load broadcast",
}: StoryBroadcastPreviewProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(28)).current;
  const routePulse = useRef(new Animated.Value(0)).current;
  const isCapacity = (post.type ?? "").toUpperCase() === "VEHICLE_AVAILABILITY";
  const heroLottie = isCapacity ? OPEN_CAPACITY_LOTTIE : LOAD_BROADCAST_LOTTIE;
  const resolvedKicker = kicker !== "Load broadcast"
    ? kicker
    : isCapacity
      ? "Open capacity"
      : "Load broadcast";

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(28);
    routePulse.setValue(0);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 0,
        tension: 72,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(routePulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(routePulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [storyKey, fade, rise, routePulse]);

  const arrowOpacity = routePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const lottieSize = isDesktopPreview ? 88 : 72;
  const vehicleHero = post.vehicle_type?.trim() || "Any vehicle";
  const showMetaRow =
    Boolean(loadMaterial?.trim()) ||
    post.weight_tonnes != null ||
    loadTargetRate != null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        isDesktopPreview && styles.wrapDesktop,
        { opacity: fade, transform: [{ translateY: rise }] },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.card, isDesktopPreview && styles.cardDesktop]}>
        <View style={styles.lottieRing}>
          <HubPromoHeroLottie
            source={heroLottie}
            width={lottieSize}
            height={lottieSize}
            renderScale={1.22}
          />
        </View>

        <Text style={[styles.kicker, isDesktopPreview && styles.kickerDesktop]}>
          {resolvedKicker}
        </Text>

        <Text
          style={[styles.heroTitle, isDesktopPreview && styles.heroTitleDesktop]}
          numberOfLines={2}
        >
          {vehicleHero}
        </Text>

        <View style={styles.routeStrip}>
          <View style={styles.routeEndpoint}>
            <View style={styles.dotOrigin} />
            <RouteEndpointStack
              value={origin}
              primaryStyle={styles.routeCity}
              secondaryStyle={styles.routeState}
              maxLinesPerItem={4}
            />
          </View>

          <Animated.View style={[styles.routeArrowWrap, { opacity: arrowOpacity }]}>
            <View style={styles.routeLine} />
            <ArrowRight size={isDesktopPreview ? 18 : 15} color={INK} strokeWidth={2.25} />
            <View style={styles.routeLine} />
          </Animated.View>

          <View style={[styles.routeEndpoint, styles.routeEndpointEnd]}>
            <View style={styles.dotDest} />
            <RouteEndpointStack
              value={destination}
              align="end"
              primaryStyle={styles.routeCity}
              secondaryStyle={styles.routeState}
              maxLinesPerItem={4}
            />
          </View>
        </View>

        {showMetaRow ? (
          <View style={styles.metaRow}>
            {loadMaterial?.trim() ? (
              <View style={styles.metaChip}>
                <Package size={11} color={MUTED} strokeWidth={2} />
                <Text style={styles.metaChipText} numberOfLines={1}>
                  {loadMaterial}
                </Text>
              </View>
            ) : null}
            {post.weight_tonnes != null ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{post.weight_tonnes}T</Text>
              </View>
            ) : null}
            {loadTargetRate != null ? (
              <View style={[styles.metaChip, styles.metaChipRate]}>
                <Text style={styles.metaChipRateText}>{formatINR(loadTargetRate)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const cardShadow = Platform.select({
  web: {
    boxShadow:
      "0 8px 28px rgba(77, 54, 54, 0.08), 0 2px 8px rgba(205, 233, 247, 0.45)",
  } as object,
  ios: {
    shadowColor: "#4D3636",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    paddingHorizontal: Layout.screenPaddingHorizontal,
  },
  wrapDesktop: {
    maxWidth: 440,
    paddingHorizontal: 0,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.loadStatusTabTrayBorder,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    ...cardShadow,
  },
  cardDesktop: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 22,
    gap: 10,
  },
  lottieRing: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: SKY_TRAY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.loadStatusTabBorderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
  },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: Theme.pulseIndigo,
    textAlign: "center",
  },
  kickerDesktop: {
    fontSize: 10,
    letterSpacing: 2.4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: INK,
    letterSpacing: -0.5,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: "100%",
  },
  heroTitleDesktop: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  routeStrip: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: SKY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.loadStatusTabBorderSoft,
  },
  routeEndpoint: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    alignItems: "flex-start",
  },
  routeEndpointEnd: {
    alignItems: "flex-end",
  },
  dotOrigin: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Theme.positive,
    marginBottom: 2,
  },
  dotDest: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Theme.pulseIndigo,
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "900",
    color: INK,
    letterSpacing: -0.2,
    maxWidth: "100%",
  },
  routeCityEnd: {
    textAlign: "right",
  },
  routeState: {
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.3,
    maxWidth: "100%",
  },
  routeStateEnd: {
    textAlign: "right",
  },
  routeArrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: 2,
    paddingTop: 18,
  },
  routeLine: {
    width: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: INK,
    opacity: 0.2,
    borderRadius: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    width: "100%",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: SKY_TRAY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.loadStatusTabBorderSoft,
    maxWidth: "100%",
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.1,
  },
  metaChipRate: {
    backgroundColor: Theme.accentGoldMuted,
    borderColor: Theme.accentGoldBorder,
  },
  metaChipRateText: {
    fontSize: 11,
    fontWeight: "900",
    color: INK,
    letterSpacing: -0.15,
  },
});
