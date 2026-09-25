/**
 * react-native-maps implementation of mapLibreCompat for Expo Go (no MapLibre native module).
 */
import React, {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import MapView, {
  type Region as RNRegion,
  Marker as RNMarker,
  Polyline as RNPolyline,
} from "react-native-maps";
import { StyleSheet, View, type ViewProps } from "react-native";

type Coordinate = { latitude: number; longitude: number };

type Region = Coordinate & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};

type EdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FitToCoordinatesOptions = {
  edgePadding?: EdgePadding;
  animated?: boolean;
};

type AnimateCameraOptions = {
  duration?: number;
};

type CameraConfig = {
  center?: Coordinate;
  heading?: number;
  pitch?: number;
  zoom?: number;
};

export type CompatMapRef = {
  fitToCoordinates: (
    coords: Coordinate[],
    options?: FitToCoordinatesOptions,
  ) => void;
  animateCamera: (camera: CameraConfig, options?: AnimateCameraOptions) => void;
  animateToRegion: (region: Region, duration?: number) => void;
};

type CompatMapProps = ViewProps & {
  children?: React.ReactNode;
  initialRegion?: Region;
  mapPadding?: EdgePadding;
  onMapReady?: () => void;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
};

type MarkerProps = {
  coordinate: Coordinate;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
};

type PolylineProps = {
  coordinates: Coordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
};

type CalloutProps = {
  children?: React.ReactNode;
};

type MarkerNode = MarkerProps & { id: string };
type PolylineNode = PolylineProps & { id: string };
type TaggedMapChildType = { __mapCompatType?: string };

const MARKER_TAG = "map-compat-marker";
const POLYLINE_TAG = "map-compat-polyline";

function zoomLevelToDelta(zoom?: number): number {
  const z = zoom ?? 15;
  const delta = 360 / Math.pow(2, Math.max(2, Math.min(20, z)));
  return Number.isFinite(delta) ? Math.min(180, Math.max(0.0005, delta)) : 0.02;
}

function toZoomFromDelta(delta?: number): number {
  if (!delta || delta <= 0) return 15;
  const zoom = Math.log2(360 / delta);
  if (!Number.isFinite(zoom)) return 15;
  return Math.max(2, Math.min(20, zoom));
}

function flattenMapChildren(
  children: React.ReactNode,
  out: { markers: MarkerNode[]; polylines: PolylineNode[]; seq: number },
) {
  Children.forEach(children, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;

    if (child.type === Fragment) {
      flattenMapChildren(child.props.children as React.ReactNode, out);
      return;
    }

    const childType = child.type;
    const typeTag =
      typeof childType === "string"
        ? undefined
        : (childType as TaggedMapChildType).__mapCompatType;
    if (typeTag === MARKER_TAG) {
      out.markers.push({
        ...(child.props as MarkerProps),
        id: `marker-${out.seq++}`,
      });
      return;
    }
    if (typeTag === POLYLINE_TAG) {
      out.polylines.push({
        ...(child.props as PolylineProps),
        id: `polyline-${out.seq++}`,
      });
    }
  });
}

const CompatMapView = forwardRef<CompatMapRef, CompatMapProps>(
  function CompatMapView(
    {
      style,
      children,
      initialRegion,
      mapPadding,
      onMapReady,
      scrollEnabled = true,
      zoomEnabled = true,
      rotateEnabled = true,
      pitchEnabled = true,
    },
    ref,
  ) {
    const mapRef = useRef<MapView | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const extracted = useMemo(() => {
      const out = {
        markers: [] as MarkerNode[],
        polylines: [] as PolylineNode[],
        seq: 0,
      };
      flattenMapChildren(children, out);
      return out;
    }, [children]);

    const initialRnRegion: RNRegion = useMemo(() => {
      const lat = initialRegion?.latitude ?? 20.5937;
      const lng = initialRegion?.longitude ?? 78.9629;
      const latD = initialRegion?.latitudeDelta ?? 0.05;
      const lngD = initialRegion?.longitudeDelta ?? latD;
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta: latD,
        longitudeDelta: lngD,
      };
    }, [initialRegion]);

    useImperativeHandle(ref, () => ({
      fitToCoordinates: (coords, options) => {
        const map = mapRef.current;
        if (!map || !coords?.length) return;
        const valid = coords.filter(
          (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
        );
        if (!valid.length) return;
        const p = options?.edgePadding ?? {};
        map.fitToCoordinates(
          valid.map((c) => ({
            latitude: c.latitude,
            longitude: c.longitude,
          })),
          {
            edgePadding: {
              top: p.top ?? 24,
              right: p.right ?? 24,
              bottom: p.bottom ?? 24,
              left: p.left ?? 24,
            },
            animated: options?.animated !== false,
          },
        );
      },
      animateCamera: (camera, options) => {
        const map = mapRef.current;
        if (!map || !camera.center) return;
        const duration = options?.duration ?? 450;
        const delta = zoomLevelToDelta(camera.zoom);
        const region: RNRegion = {
          latitude: camera.center.latitude,
          longitude: camera.center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        };
        const anyMap = map as unknown as {
          animateCamera?: (
            c: Record<string, unknown>,
            opts?: { duration?: number },
          ) => void;
        };
        if (typeof anyMap.animateCamera === "function") {
          anyMap.animateCamera(
            {
              center: {
                latitude: camera.center.latitude,
                longitude: camera.center.longitude,
              },
              zoom: camera.zoom,
              heading: camera.heading,
              pitch: camera.pitch,
            },
            { duration },
          );
        } else {
          map.animateToRegion(region, duration);
        }
      },
      animateToRegion: (region, duration = 450) => {
        const map = mapRef.current;
        if (!map) return;
        const d = zoomLevelToDelta(
          toZoomFromDelta(region.longitudeDelta ?? region.latitudeDelta),
        );
        map.animateToRegion(
          {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta ?? d,
            longitudeDelta: region.longitudeDelta ?? d,
          },
          duration,
        );
      },
    }));

    return (
      <View style={style}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRnRegion}
          mapPadding={{
            top: mapPadding?.top ?? 0,
            right: mapPadding?.right ?? 0,
            bottom: mapPadding?.bottom ?? 0,
            left: mapPadding?.left ?? 0,
          }}
          scrollEnabled={scrollEnabled}
          zoomEnabled={zoomEnabled}
          rotateEnabled={rotateEnabled}
          pitchEnabled={pitchEnabled}
          onMapReady={() => {
            if (!mapReady) {
              setMapReady(true);
              onMapReady?.();
            }
          }}
        >
          {extracted.polylines.map((line) => {
            const coords = (line.coordinates ?? []).filter(
              (c) =>
                Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
            );
            if (coords.length < 2) return null;
            return (
              <RNPolyline
                key={line.id}
                coordinates={coords}
                strokeColor={line.strokeColor ?? "#2563eb"}
                strokeWidth={line.strokeWidth ?? 4}
                lineCap={line.lineCap ?? "round"}
                lineJoin={line.lineJoin ?? "round"}
              />
            );
          })}

          {extracted.markers.map((marker) => (
            <RNMarker
              key={marker.id}
              coordinate={marker.coordinate}
              anchor={marker.anchor}
            >
              {marker.children ? (
                <View>{marker.children}</View>
              ) : (
                <View style={styles.defaultMarker} />
              )}
            </RNMarker>
          ))}
        </MapView>
      </View>
    );
  },
);

export const Marker = (() => null) as React.FC<MarkerProps> & {
  __mapCompatType?: string;
};
Marker.__mapCompatType = MARKER_TAG;

export const Polyline = (() => null) as React.FC<PolylineProps> & {
  __mapCompatType?: string;
};
Polyline.__mapCompatType = POLYLINE_TAG;

export const Callout = (({ children }: CalloutProps) => (
  <>{children}</>
)) as React.FC<CalloutProps> & {
  __mapCompatType?: string;
};
Callout.__mapCompatType = "map-compat-callout";

export const PROVIDER_GOOGLE = "google";
export default CompatMapView;

const styles = StyleSheet.create({
  defaultMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
