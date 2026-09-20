import Feather from "@expo/vector-icons/Feather";
import { Fuel, Layers, MapPin } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { DriverOpsLauncherOption } from "@/features/trips/operations/shared/DriverOpsLauncherOption";
import type { TripRow } from "@/features/trips/services/trips.service";
import { ROUTES } from "@/lib/routes";
import { useLeaveTripExpenseEntry } from "../shared/useLeaveTripExpenseEntry";

type ExpenseKind = "fuel" | "toll" | "other";

const TILES = [
  {
    kind: "fuel" as const,
    title: "Fuel",
    subtitle: "Pump bills · liters · station",
    Icon: Fuel,
    iconTint: "#047857",
    iconBg: "rgba(16,185,129,0.12)",
  },
  {
    kind: "toll" as const,
    title: "Toll & FASTag",
    subtitle: "Plaza receipts · FASTag slips",
    Icon: MapPin,
    iconTint: "#4D3636",
    iconBg: "rgba(99,102,241,0.12)",
  },
  {
    kind: "other" as const,
    title: "Other costs",
    subtitle: "Parking · loading · food · misc",
    Icon: Layers,
    iconTint: "#0369a1",
    iconBg: "rgba(14,165,233,0.12)",
  },
];

function routeForKind(tripId: string, kind: ExpenseKind): string {
  switch (kind) {
    case "fuel":
      return ROUTES.tripFuelEntry(tripId);
    case "toll":
      return ROUTES.tripTollEntry(tripId);
    default:
      return ROUTES.tripOtherExpenseEntry(tripId);
  }
}

export function TripExpenseLauncherScreen({ trip }: { trip: TripRow }) {
  const router = useRouter();
  const leave = useLeaveTripExpenseEntry(trip.id);
  const insets = useSafeAreaInsets();

  const contextLine = useMemo(
    () => `${trip.pickup_area || "Pickup"} → ${trip.drop_location || "Drop"}`,
    [trip.drop_location, trip.pickup_area],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <Pressable style={styles.backBtn} onPress={leave} hitSlop={10}>
            <Feather name="arrow-left" size={18} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Feather name="plus-circle" size={20} color={Theme.driverEmeraldDark} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Trip expense</Text>
            <Text style={styles.heroTitle}>Log an expense</Text>
            <View style={styles.routeInline}>
              <Feather name="navigation" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={styles.routeInlineText} numberOfLines={2}>
                {contextLine}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.heroHint} numberOfLines={2}>
          Choose a category — attach a bill photo on the form for AI scan.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.sectionRule} />
        </View>

        <View style={styles.options}>
          {TILES.map((tile) => (
            <DriverOpsLauncherOption
              key={tile.kind}
              title={tile.title}
              subtitle={tile.subtitle}
              Icon={tile.Icon}
              iconTint={tile.iconTint}
              iconBg={tile.iconBg}
              onPress={() => router.push(routeForKind(trip.id, tile.kind) as never)}
              accessibilityLabel={`Add ${tile.title} expense`}
            />
          ))}
        </View>

        <View style={styles.tipCard}>
          <Feather name="camera" size={14} color={Theme.driverEmeraldDark} />
          <Text style={styles.tipText}>
            Bill photo OCR extracts amount, category, city, and vendor on every expense form.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.screenBackground,
  },
  header: {
    flexShrink: 0,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 12,
    backgroundColor: Theme.driverEmeraldDark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    gap: 8,
    zIndex: 3,
    elevation: 3,
    position: "relative",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.72)",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.35,
  },
  routeInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 2,
    minWidth: 0,
  },
  routeInlineText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    color: "rgba(255,255,255,0.82)",
  },
  heroHint: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    color: "rgba(255,255,255,0.72)",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.borderLight,
  },
  options: {
    gap: 10,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Theme.driverEmeraldMuted,
    borderWidth: 1,
    borderColor: "rgba(4,120,87,0.15)",
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    color: Theme.driverEmeraldDark,
  },
});
