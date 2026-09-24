import {
  TRACKING_CHANNEL_FLEET_PREFIX,
  TRACKING_CHANNEL_FLEET_SUFFIX,
  TRACKING_CHANNEL_TRIP_PREFIX,
} from '../constants';

export function trackingTripChannelName(tripId: string): string {
  return `${TRACKING_CHANNEL_TRIP_PREFIX}${tripId}`;
}

export function trackingFleetChannelName(orgId: string): string {
  return `${TRACKING_CHANNEL_FLEET_PREFIX}${orgId}${TRACKING_CHANNEL_FLEET_SUFFIX}`;
}
