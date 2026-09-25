import type { TrackingPositionPayload, TrackingBroadcastPayload } from '@pulse/domain/features/tracking/types/broadcast.types';
export type { TrackingBroadcastEventName, TrackingPositionPayload, TrackingSessionPayload, TrackingCheckpointPayload, TrackingReseedPayload, TrackingPingRequestPayload, FleetPositionPayload, TrackingBroadcastPayload } from '@pulse/domain/features/tracking/types/broadcast.types';


export function isTrackingPositionPayload(
  p: TrackingBroadcastPayload,
): p is TrackingPositionPayload {
  return 'latitude' in p && 'tripId' in p && 'sessionId' in p && !('checkpointId' in p);
}
