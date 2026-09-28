/**
 * Ratings/feedback placeholder shown on trip detail before a trip is completed.
 * Extracted verbatim from TripDetailScreen.tsx (no behavior change).
 */
import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";

import Theme from "@/constants/Theme";

export function FeedbackPlaceholder() {
  return (
    <View style={fbStyles.card}>
      <View style={fbStyles.headerRow}>
        <View style={fbStyles.titleCluster}>
          <View style={fbStyles.awardCircle}>
            <Feather name="award" size={18} color={Theme.analyticsHeroBg} />
          </View>
          <View style={fbStyles.titleTextWrap}>
            <Text style={fbStyles.title}>Ratings</Text>
            <Text style={fbStyles.subtitle}>
              Track service quality across completed trips
            </Text>
          </View>
        </View>
      </View>
      <View style={fbStyles.body}>
        <Feather name="clock" size={28} color={Theme.borderMedium} />
        <Text style={fbStyles.message}>
          Feedback available once the trip is completed
        </Text>
        <Text style={fbStyles.sub}>
          Driver, supplier, and client ratings will appear here with audit-style
          entries when this voyage is closed.
        </Text>
      </View>
    </View>
  );
}

const fbStyles = StyleSheet.create({
  card: {
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 4,
    shadowColor: Theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  titleCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  awardCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(43,49,113,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 1,
  },
  body: {
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 10,
  },
  message: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textSecondary,
    textAlign: "center",
  },
  sub: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 18,
  },
});
