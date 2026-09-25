/**
 * Driver profile hub — Counterparty-style chrome; existing Overview / Compliance / Finance content.
 */
import Theme from "@/constants/Theme";
import {
  clientProfileStyles as cpStyles,
  hubStyles as styles,
} from "@/features/clients/components/desktop/clientProfileHub.styles";
import { DriverProfileOverviewPanel } from "@/features/drivers/components/desktop/DriverProfileOverviewPanel";
import { partnerProfileDashboardStyles as party } from "@/features/drivers/components/partnerProfileDashboard.styles";
import type { DriverRow } from "@/features/drivers/services/drivers.service";
import { profileHubLayoutStyles as mobile } from "@/features/party/components/profileHubLayout.styles";
import { useProfileHubCompact } from "@/features/party/hooks/useProfileHubCompact";
import { useLayoutInsets } from "@/lib/layoutInsets";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

type DriverProfileTab = "overview" | "compliance" | "finance";

const TABS: { id: DriverProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "compliance", label: "Compliance" },
  { id: "finance", label: "Finance · Statement" },
];

type Props = {
  driver: DriverRow;
  tripCount: number;
  vehicleLabel: string | null;
  ratingCount: number;
  tenureCount: number;
  onBack?: () => void;
};

export function DriverProfileHub({
  driver,
  tripCount,
  vehicleLabel,
  ratingCount: _ratingCount,
  tenureCount: _tenureCount,
  onBack,
}: Props) {
  const router = useRouter();
  const compact = useProfileHubCompact();
  const layoutInsets = useLayoutInsets();
  const [tab, setTab] = useState<DriverProfileTab>("overview");

  const panel =
    tab === "overview" ? (
      <DriverProfileOverviewPanel
        driver={driver}
        tripCount={tripCount}
        vehicleLabel={vehicleLabel}
      />
    ) : tab === "compliance" ? (
      <View style={[styles.card, compact && mobile.cardCompact]}>
        <Text style={[styles.cardTitle, compact && mobile.cardTitleCompact]}>Compliance</Text>
        <Text style={[styles.aboutBody, compact && mobile.aboutBodyCompact]}>
          Licence: {driver.license_number?.trim() || "Not on file"}
          {"\n"}Emergency: {driver.emergency_name?.trim() || "—"} ·{" "}
          {driver.emergency_contact?.trim() || "—"}
        </Text>
      </View>
    ) : (
      <View style={[styles.card, compact && mobile.cardCompact]}>
        <Text style={[styles.cardTitle, compact && mobile.cardTitleCompact]}>
          Finance · Statement
        </Text>
        <Text style={[styles.aboutBody, compact && mobile.aboutBodyCompact]}>
          Open the driver ledger for payable balance, salary requests, and trip settlements.
        </Text>
        <Pressable
          style={[
            cpStyles.quickActionBtn,
            cpStyles.quickActionBtnPrimary,
            { alignSelf: "flex-start", marginTop: 12 },
          ]}
          onPress={() =>
            router.push(`/fleet-driver/${driver.id}` as Parameters<typeof router.push>[0])
          }
        >
          <Wallet size={14} color={Theme.textOnPrimary} />
          <Text style={[cpStyles.quickActionText, cpStyles.quickActionTextPrimary]}>
            Open ledger
          </Text>
        </Pressable>
      </View>
    );

  return (
    <View style={party.viewRoot}>
      <View style={party.viewStickyHeader}>
        <View style={party.viewStickyLeft}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={party.iconBtn}
              hitSlop={12}
              accessibilityLabel="Back"
            >
              <FontAwesome name="chevron-left" size={22} color={Theme.textPrimaryDark} />
            </Pressable>
          ) : null}
          <Text style={party.viewStickyTitle} numberOfLines={1}>
            Driver Profile
          </Text>
        </View>
        <View style={party.viewStickyRight}>
          <View style={[party.badge, { backgroundColor: Theme.surfaceGray, borderColor: Theme.borderMedium }]}>
            <Text style={[party.badgeText, { color: Theme.textMuted }]}>DRIVER</Text>
          </View>
        </View>
      </View>

      <View style={party.viewTabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              style={[party.viewTabChip, active && party.viewTabChipActive]}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[party.viewTabChipText, active && party.viewTabChipTextActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          party.hubBody,
          compact && mobile.scrollContentCompact,
          { paddingBottom: layoutInsets.scrollBottomPadding(compact ? 16 : 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {panel}
      </ScrollView>
    </View>
  );
}
