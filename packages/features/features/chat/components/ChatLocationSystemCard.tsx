import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import type { TripMessageRow } from "@pulse/domain/features/chat/types/chat.types";
import type { SystemLogLocationData } from "@pulse/domain/features/chat/utils/locationLogPayload.util";
import {
  buildLocationPingCardCopy,
  isRealLocationSample,
  isSimulatedLocationPing,
  resolveLocationCityLabel,
  type LocationPingTripHint,
} from "@pulse/domain/features/chat/utils/locationPingChatDisplay.util";
import { formatTripEventSheetDate, TripProgressEventCard } from "./ChatEventCard";
import {
  resolveLocationPingDriverAvatar,
  type LocationPingDriverContext,
} from "@pulse/domain/features/chat/utils/chatAvatar.util";

export interface ChatLocationSystemCardProps {
  message: TripMessageRow;
  location: SystemLogLocationData | null;
  isMobile?: boolean;
  consolidatedCount?: number;
  tripHint?: LocationPingTripHint;
  composeTrip?: LocationPingDriverContext["composeTrip"];
  conversationDriverId?: string | null;
  /** Driver's own outgoing ping — show "Location shared" receipt instead of system card. */
  isOwnDriverSend?: boolean;
}

/**
 * System-update style card for driver location pings — city label only, no map tiles.
 *
 * When `isOwnDriverSend` is true (driver viewing their own outgoing ping), renders a
 * compact sent-receipt card instead of the dispatcher system-update style — mirrors
 * WhatsApp's sent-location bubble.
 */
export function ChatLocationSystemCard({
  message,
  location,
  consolidatedCount,
  tripHint,
  composeTrip,
  conversationDriverId,
  isOwnDriverSend = false,
}: ChatLocationSystemCardProps) {
  const simulated = isSimulatedLocationPing(message);
  const cityLabel = resolveLocationCityLabel(
    location,
    message.content,
    tripHint,
  );

  let displayTime = message.created_at;
  try {
    displayTime = new Date(message.created_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    // keep raw
  }

  // ── Driver's own outgoing ping ────────────────────────────────────────────
  if (isOwnDriverSend) {
    return (
      <View style={s.sentWrap}>
        <View style={s.sentCard}>
          <MapPin size={13} color="#15803d" strokeWidth={2.2} />
          <Text style={s.sentText}>
            {simulated ? "Simulated location" : "Location"}{" "}
            <Text style={s.sentBold}>shared with employer</Text>
          </Text>
          {cityLabel ? <Text style={s.sentCity}> · {cityLabel}</Text> : null}
          <Text style={s.sentTime}>{displayTime}</Text>
        </View>
      </View>
    );
  }

  // ── Business / dispatcher view ────────────────────────────────────────────
  const { title, subLine, captureClock } = buildLocationPingCardCopy({
    location,
    message,
    simulated,
    consolidatedCount,
    tripHint,
  });
  const dateUpper = formatTripEventSheetDate(message.created_at);
  // Only claim "DRIVER LOCATION"/"LIVE" when there's an actual reading behind
  // it — otherwise this is a trip-phase guess (pickup/drop fallback) and
  // labeling it "LIVE" is the exact bug this distinction exists to prevent.
  const isReal = isRealLocationSample(location, message.content);
  const statusLabel = simulated
    ? "SIMULATED LOCATION"
    : isReal
      ? "DRIVER LOCATION"
      : "TRIP STATUS (ESTIMATED)";
  const metaLine = `${dateUpper} · ${statusLabel}`;
  const driverAvatar = resolveLocationPingDriverAvatar(message, {
    composeTrip,
    conversationDriverId,
  });
  const rightPrimary = simulated ? "SIM" : isReal ? "LIVE" : "EST";
  const rightPrimaryColor = simulated ? "#D97706" : isReal ? "#059669" : "#6b7280";

  return (
    <TripProgressEventCard
      avatarSeed={driverAvatar.displayName}
      avatarIdentity={driverAvatar}
      eventKind="location"
      simulated={simulated}
      kicker="SYSTEM UPDATE"
      title={title}
      subLine={subLine}
      captureClock={captureClock}
      metaLine={metaLine}
      rightPrimary={rightPrimary}
      rightPrimaryColor={rightPrimaryColor}
      time={displayTime}
    />
  );
}

const s = StyleSheet.create({
  sentWrap: {
    alignItems: "flex-end",
    paddingRight: 4,
    marginVertical: 2,
  },
  sentCard: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "80%",
  },
  sentText: {
    fontSize: 11,
    color: "#166534",
    flexShrink: 1,
  },
  sentBold: { fontWeight: "700" },
  sentCity: {
    fontSize: 10,
    color: "#15803d",
    fontStyle: "italic",
  },
  sentTime: {
    fontSize: 9,
    color: "#6b7280",
    marginLeft: "auto" as unknown as number,
    flexShrink: 0,
  },
});
