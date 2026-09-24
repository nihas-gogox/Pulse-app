import { type Href, useRouter } from "expo-router";
import {
  ChevronRight,
  Receipt,
  Route,
  Wallet,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";
import { useDriverTripOps } from "../../../contexts/DriverTripOpsContext";
import { ROUTES } from "@pulse/core/lib/routes";

/**
 * Expense mode chooser:
 * - Active trip card → trip other-expense entry (fleet reimbursement)
 * - General card → personal / offline expense (local + WhatsApp)
 */
export function DriverExpenseCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useDriverThemeColors();
  const {
    hasTargetTrip,
    showExpenseOps,
    activeTripSummary,
    openTripExpense,
  } = useDriverTripOps();

  const tripEnabled = hasTargetTrip && showExpenseOps;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.backHit}
        >
          <Text style={[styles.backText, { color: colors.emerald }]}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: `${colors.emerald}18` }]}>
          <Receipt size={22} color={colors.emerald} strokeWidth={2.2} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Capture expense</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Active trip costs go to fleet review. General expenses stay with you and
          can be shared offline.
        </Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          disabled={!tripEnabled}
          onPress={() => openTripExpense()}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: tripEnabled ? colors.emerald : colors.border,
              opacity: !tripEnabled ? 0.55 : pressed ? 0.92 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !tripEnabled }}
          accessibilityLabel="Active trip expense"
        >
          <View style={[styles.cardIcon, { backgroundColor: `${colors.emerald}18` }]}>
            <Route size={18} color={colors.emerald} strokeWidth={2.2} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Active trip
            </Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={2}>
              {tripEnabled
                ? activeTripSummary ?? "Log fuel, toll, or other trip costs"
                : "No active trip available for in-app expenses"}
            </Text>
          </View>
          <ChevronRight
            size={16}
            color={tripEnabled ? colors.emerald : colors.textMuted}
            strokeWidth={2.2}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push(ROUTES.driverGeneralExpense() as Href)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="General expense"
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.border }]}>
            <Wallet size={18} color={colors.textMuted} strokeWidth={2.2} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              General expense
            </Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={2}>
              Personal / out-of-pocket — save on device and share with fleet
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.2} />
        </Pressable>
      </View>

      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        Trip expenses sync for reimbursement. General notes are device-local and
        shared via WhatsApp.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginBottom: 8,
  },
  backHit: {
    minHeight: 44,
    justifyContent: "center",
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  hero: {
    alignItems: "flex-start",
    marginBottom: 22,
    gap: 8,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    maxWidth: 340,
  },
  cards: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 76,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  footnote: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    paddingHorizontal: 2,
  },
});
