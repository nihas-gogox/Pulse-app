/**
 * Native live-tracking map — route + driver pin via TrackingMapBlock (Leaflet/MapLibre).
 * Web uses TripMap.web.tsx (full desktop Leaflet trip detail map).
 */
import { Dimensions, StyleSheet, View } from "react-native";
import { TrackingMapBlock } from "./TrackingMapBlock";
import type { TripMapProps } from "./TripMap";

export function TripMap({
  sourceCoords,
  destCoords,
  truckLocation,
  dbLocationTrail,
  truckStatus,
  height,
  fitPaddingBottom,
  driverAvatarUri,
  driverAvatarSeed,
  driverOnline,
}: TripMapProps) {
  const fillParent = height === "100%";
  const windowH = Dimensions.get("window").height;
  const mapHeight =
    typeof height === "number"
      ? height
      : fillParent
        ? Math.max(320, windowH)
        : 320;
  const trail = (dbLocationTrail ?? []).map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    recorded_at: p.recorded_at ?? "",
  }));

  return (
    <View style={[styles.wrap, fillParent && styles.fill]}>
      <TrackingMapBlock
        mapHeight={mapHeight}
        vehicleLabel={truckStatus?.truckNo ?? null}
        originCoordinate={sourceCoords ?? null}
        destinationCoordinate={destCoords ?? null}
        latestLocation={truckLocation ?? null}
        tripLocationPoints={trail}
        locationAddress={truckStatus?.location ?? null}
        fitPaddingBottom={fitPaddingBottom}
        driverAvatarUri={driverAvatarUri}
        driverAvatarSeed={driverAvatarSeed}
        driverOnline={driverOnline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {
    flex: 1,
    minHeight: 280,
  },
});
