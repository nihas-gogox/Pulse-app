import { useEffect, useRef } from 'react';
import { getDriverTrackingSessionManager } from '../session/DriverTrackingSessionManager';
import { isTrackingBroadcastV1Enabled } from '@pulse/domain/features/tracking/trackingFeatureFlags';

type SessionArgs = {
  tripId: string | null;
  driverId: string | null;
  orgId: string | null;
  tripActive: boolean;
};

/**
 * Binds driver tracking session lifecycle to active trip (broadcast only).
 */
export function useDriverTrackingSessionLifecycle({
  tripId,
  driverId,
  orgId,
  tripActive,
}: SessionArgs): void {
  const enabled = isTrackingBroadcastV1Enabled();

  useEffect(() => {
    if (!enabled) return;
    const mgr = getDriverTrackingSessionManager();
    if (tripActive && tripId && driverId && orgId) {
      void mgr.start({ tripId, driverId, orgId });
      return () => {
        void mgr.stop();
      };
    }
    void mgr.stop();
  }, [enabled, tripActive, tripId, driverId, orgId]);
}

/**
 * After DB checkpoint success, publish throttled broadcast position.
 */
export function usePublishTrackingOnCheckpoint() {
  const enabled = isTrackingBroadcastV1Enabled();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  return async (args: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: string;
  }): Promise<void> => {
    if (!enabledRef.current) return;
    await getDriverTrackingSessionManager().publishPositionIfNeeded(args);
  };
}
