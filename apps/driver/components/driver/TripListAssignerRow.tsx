import { PartyAvatar } from "@pulse/features/components/PartyAvatar";
import type { JobCardAssignerPayload } from "@pulse/domain/features/trips/utils/driverAssignerDisplay.util";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  assigner: JobCardAssignerPayload | null;
  fallback?: string;
  mutedColor: string;
  textColor: string;
  /** Compact row for trip list cards (default). */
  compact?: boolean;
};

export function TripListAssignerRow({
  assigner,
  fallback = "Fleet dispatcher",
  mutedColor,
  textColor,
  compact = true,
}: Props) {
  const primary = assigner?.linePrimary.trim() ?? "";
  const secondary = assigner?.lineSecondary.trim() ?? "";
  const hasLines = Boolean(primary || secondary);
  const avatarSize = compact ? 28 : 34;
  const labelStyle = compact ? styles.labelCompact : styles.label;
  const primaryStyle = compact ? styles.primaryCompact : styles.primary;
  const secondaryStyle = compact ? styles.secondaryCompact : styles.secondary;

  if (!assigner || !hasLines) {
    return (
      <View style={[styles.row, compact && styles.rowCompact]}>
        <View style={styles.avatarWrap}>
          <PartyAvatar
            name={fallback}
            entityType="client"
            size={avatarSize}
            borderStyle={styles.avatarBorder}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={[labelStyle, { color: mutedColor }]} numberOfLines={1}>
            Assigned by
          </Text>
          <Text style={[primaryStyle, { color: textColor }]} numberOfLines={1}>
            {fallback}
          </Text>
        </View>
      </View>
    );
  }

  const avatarName = assigner.orgName || primary || "Fleet";

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.avatarWrap}>
        <PartyAvatar
          name={avatarName}
          initialsColorSeed={assigner.orgId || assigner.orgName}
          organizationImageUrl={assigner.orgLogoUrl}
          organizationAvatarSeed={assigner.orgAvatarSeed}
          avatarUrl={assigner.orgAvatarUrl}
          entityType="client"
          size={avatarSize}
          borderStyle={styles.avatarBorder}
        />
      </View>
      <View style={styles.textCol}>
        <Text style={[labelStyle, { color: mutedColor }]} numberOfLines={1}>
          Assigned by
        </Text>
        <Text style={styles.partyLine} numberOfLines={1}>
          <Text style={[primaryStyle, { color: textColor }]}>
            {primary || avatarName}
          </Text>
          {secondary ? (
            <>
              <Text style={[styles.dot, { color: mutedColor }]}> · </Text>
              <Text style={[secondaryStyle, { color: mutedColor }]}>
                {secondary}
              </Text>
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    minWidth: 0,
  },
  rowCompact: {
    marginTop: 6,
    gap: 7,
  },
  avatarWrap: {
    flexShrink: 0,
    alignSelf: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 1,
  },
  partyLine: {
    lineHeight: 14,
  },
  avatarBorder: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  labelCompact: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.25,
    lineHeight: 11,
  },
  primaryCompact: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  secondaryCompact: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
    letterSpacing: 0.2,
  },
  primary: {
    fontSize: 13,
    fontWeight: "700",
  },
  secondary: {
    fontSize: 12,
    fontWeight: "500",
  },
  dot: {
    fontWeight: "500",
  },
});
