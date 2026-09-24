// Types for the platform-split module (reactNativeMapsCompat.native.ts / .web.tsx).
// Module form (was ambient 'declare module' keyed on the old '@/lib/…' path) — driver extraction, Phase 3.
import type * as React from "react";
import type { ComponentType, ReactNode } from "react";
import type { ViewProps } from "react-native";
type Coordinate = { latitude: number; longitude: number };
type Region = Coordinate & { latitudeDelta?: number; longitudeDelta?: number };
type EdgePadding = { top?: number; right?: number; bottom?: number; left?: number };
type FitOptions = { edgePadding?: EdgePadding; animated?: boolean };
type CameraOptions = { duration?: number };
type Camera = { center?: Coordinate; heading?: number; pitch?: number; zoom?: number };
export interface MapViewRef {
  fitToCoordinates: (coords: Coordinate[], options?: FitOptions) => void;
  animateCamera: (camera: Camera, options?: CameraOptions) => void;
  animateToRegion: (region: Region, duration?: number) => void;
}
export const Callout: ComponentType<ViewProps & { children?: ReactNode }>;
export const Marker: ComponentType<
  ViewProps & {
    coordinate?: Coordinate;
    anchor?: { x: number; y: number };
    title?: string;
    /** Reanimated animated marker (native only). */
    animatedProps?: object;
    children?: ReactNode;
  }
>;
export const Polyline: ComponentType<
  ViewProps & {
    coordinates?: Coordinate[];
    strokeColor?: string;
    strokeWidth?: number;
    lineCap?: string;
    lineJoin?: string;
    children?: ReactNode;
  }
>;
export const PROVIDER_GOOGLE: string;
const MapView: React.ForwardRefExoticComponent<
  ViewProps & Record<string, unknown>
>;
export default MapView;
