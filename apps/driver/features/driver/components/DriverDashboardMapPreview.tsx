/**
 * Compact map preview on the idle driver dashboard — Leaflet on web, native fallback elsewhere.
 */
import { LeafletMap } from "@pulse/ui/components/driver/LeafletMap";
import type { LeafletLatLng } from "@pulse/ui/components/driver/LeafletMap.types";
import Theme from "@pulse/core/constants/Theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Maximize2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Coordinate = LeafletLatLng;

type Props = {
  center: Coordinate;
  avatarUri?: string | null;
  avatarSeed?: string | null;
  isOnline?: boolean;
  borderColor: string;
  surfaceColor: string;
  textColor: string;
  textMuted: string;
  locationLabel?: string | null;
  onPressExpand?: () => void;
};

export function DriverDashboardMapPreview({
  center,
  avatarUri,
  avatarSeed,
  isOnline = false,
  borderColor,
  surfaceColor,
  textColor,
  textMuted,
  locationLabel,
  onPressExpand,
}: Props) {
  const [mapReady, setMapReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web") return;

    let cancelled = false;
    const start = () => {
      if (!cancelled) setMapReady(true);
    };

    const idleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    const idleId =
      typeof idleCallback === "function"
        ? idleCallback(start, { timeout: 1200 })
        : window.setTimeout(start, 400);

    return () => {
      cancelled = true;
      const cancelIdle = (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback;
      if (typeof cancelIdle === "function" && typeof idleCallback === "function") {
        cancelIdle(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  const markers = useMemo(
    () => [
      {
        id: "you",
        coordinate: center,
        label: "You",
        avatarUri: avatarUri ?? undefined,
        avatarSeed: avatarSeed ?? undefined,
        isOnline,
      },
    ],
    [avatarSeed, avatarUri, center, isOnline],
  );

  return (
    <Pressable
      onPress={onPressExpand}
      disabled={!onPressExpand}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: surfaceColor,
          borderColor,
          opacity: pressed && onPressExpand ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Map preview"
      accessibilityHint="Tap to open full screen map"
    >
      <View style={styles.mapShell} pointerEvents="none">
        {mapReady ? (
          <LeafletMap
            style={styles.map}
            center={center}
            zoom={14}
            markers={markers}
            lowPower
            interactionLocked
            showZoomControls={false}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="small" color={Theme.driverEmerald} />
          </View>
        )}
        <View style={styles.mapFade} />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <FontAwesome name="map-marker" size={13} color={Theme.driverEmerald} />
          <View style={styles.footerText}>
            <Text style={[styles.title, { color: textColor }]}>Live map</Text>
            <Text style={[styles.subtitle, { color: textMuted }]} numberOfLines={1}>
              {locationLabel?.trim() || "Your current area"}
            </Text>
          </View>
        </View>
        {onPressExpand ? (
          <View style={[styles.expandBtn, { borderColor }]}>
            <Maximize2 size={14} color={textColor} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)" as unknown as undefined,
      },
      default: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  mapShell: {
    height: 168,
    position: "relative",
    backgroundColor: "#e2e8f0",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
  },
  mapFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  footerText: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 13, fontWeight: "700" },
  subtitle: { fontSize: 11, fontWeight: "500" },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
