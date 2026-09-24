/** Imperative API exposed by native MapView wrappers (react-native-maps / MapLibre compat). */
export type MapViewCoordinate = { latitude: number; longitude: number };

export type MapViewRegion = MapViewCoordinate & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type MapViewEdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type MapViewFitOptions = {
  edgePadding?: MapViewEdgePadding;
  animated?: boolean;
};

export type MapViewCamera = {
  center?: MapViewCoordinate;
  heading?: number;
  pitch?: number;
  zoom?: number;
};

export type MapViewCameraOptions = { duration?: number };

export type MapViewRef = {
  fitToCoordinates: (
    coords: MapViewCoordinate[],
    options?: MapViewFitOptions,
  ) => void;
  animateCamera?: (camera: MapViewCamera, options?: MapViewCameraOptions) => void;
  animateToRegion?: (region: MapViewRegion, duration?: number) => void;
};
