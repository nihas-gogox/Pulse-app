import Theme from "@/constants/Theme";
import { formatINR } from "@/lib/format";
import LottieView from "lottie-react-native";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  tripMarginLottie,
  tripMarginTone,
  type TripMarginTone,
} from "./tripMarginAssets";

export type TripMarginHeroProps = {
  amount: number;
  basisLabel: string;
  layout?: "mobile" | "desktop";
};

const LOTTIE_SIZE = { mobile: 44, desktop: 40 } as const;
const LOTTIE_RENDER_SCALE = 1.75;
const LOTTIE_SPEED: Record<TripMarginTone, number> = {
  profit: 0.9,
  loss: 1,
  flat: 0.75,
};

function marginLabel(tone: TripMarginTone): string {
  if (tone === "loss") return "Margin · loss";
  return "Margin";
}

export const TripMarginHero = memo(function TripMarginHero({
  amount,
  basisLabel,
  layout = "mobile",
}: TripMarginHeroProps) {
  const isDesktop = layout === "desktop";
  const tone = tripMarginTone(amount);
  const lottieSize = isDesktop ? LOTTIE_SIZE.desktop : LOTTIE_SIZE.mobile;
  const lottieRenderSize = Math.round(lottieSize * LOTTIE_RENDER_SCALE);

  return (
    <View
      style={[
        styles.card,
        isDesktop && styles.cardDesktop,
        tone === "loss" && styles.cardLoss,
        tone === "profit" && styles.cardProfit,
      ]}
    >
      <View style={[styles.lottieSlot, { width: lottieSize, height: lottieSize }]}>
        <LottieView
          key={tone}
          source={tripMarginLottie(tone)}
          autoPlay
          loop
          speed={LOTTIE_SPEED[tone]}
          resizeMode="contain"
          style={{
            width: lottieRenderSize,
            height: lottieRenderSize,
            position: "absolute",
          }}
        />
      </View>

      <Text style={[styles.label, isDesktop && styles.labelDesktop]}>
        {marginLabel(tone)}
      </Text>

      <Text
        style={[
          styles.value,
          isDesktop && styles.valueDesktop,
          tone === "loss" && styles.valueLoss,
          isDesktop && tone === "loss" && styles.valueLossDesktop,
          tone === "profit" && styles.valueProfit,
        ]}
      >
        {formatINR(amount)}
      </Text>

      <Text style={[styles.hint, isDesktop && styles.hintDesktop]} numberOfLines={2}>
        {basisLabel}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6edf5",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    alignSelf: "stretch",
    overflow: "hidden",
  },
  cardDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 0,
  },
  cardLoss: {
    borderColor: "rgba(220,38,38,0.25)",
    backgroundColor: Theme.negativeMuted,
  },
  cardProfit: {
    borderColor: Theme.positiveMutedDarkBorder,
    backgroundColor: Theme.positiveMutedDark,
  },
  lottieSlot: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "visible",
  },
  label: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Theme.textMuted,
    textAlign: "center",
  },
  labelDesktop: {
    fontSize: 10,
    letterSpacing: 1,
  },
  value: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.2,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
  },
  valueDesktop: {
    fontSize: 22,
    lineHeight: 26,
  },
  valueLoss: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "900",
    color: Theme.negative,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  valueLossDesktop: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  valueProfit: {
    color: Theme.positive,
    fontWeight: "800",
  },
  hint: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: "500",
    color: Theme.textMuted,
    textAlign: "center",
    lineHeight: 11,
  },
  hintDesktop: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
});
