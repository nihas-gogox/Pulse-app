import { Platform } from "react-native";
import type { Accuracy, LocationObject } from "expo-location";

export type ForegroundPositionWatchHandle = {
  remove: () => void;
};

type WatchOptions = {
  accuracy?: Accuracy;
  timeInterval?: number;
  distanceInterval?: number;
};

function webPositionToLocationObject(position: GeolocationPosition): LocationObject {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? null,
      accuracy: position.coords.accuracy ?? null,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null,
    },
    timestamp: position.timestamp,
  };
}

/**
 * Foreground position watch that avoids expo-location teardown on web
 * (`LocationEventEmitter.removeSubscription` is not implemented there).
 */
export async function startForegroundPositionWatch(
  options: WatchOptions,
  onLocation: (location: LocationObject) => void,
): Promise<ForegroundPositionWatchHandle | null> {
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => onLocation(webPositionToLocationObject(position)),
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: Math.max(0, options.timeInterval ?? 3000),
        timeout: 15_000,
      },
    );
    return {
      remove: () => {
        navigator.geolocation.clearWatch(watchId);
      },
    };
  }

  const Location = await import("expo-location");
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const subscription = await Location.watchPositionAsync(options, (position) => {
    onLocation({
      coords: position.coords,
      timestamp: Date.now(),
    });
  });
  return {
    remove: () => {
      try {
        subscription.remove();
      } catch {
        // Guard older expo-location builds on web if Platform.OS is misreported.
      }
    },
  };
}
