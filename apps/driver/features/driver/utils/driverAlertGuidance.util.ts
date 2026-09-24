import type { OperationalAlert } from '@pulse/domain/features/trips/domain/tripOperationalAlerts';

/**
 * Translates Operational Alerts into plain, action-oriented driver copy.
 * Deliberately NOT in features/trips/domain — that layer computes the truth
 * (rules, severities, thresholds), this is copy for one specific audience.
 * Drivers don't see alert titles like "Vehicle behind schedule" or "Pickup
 * dwell exceeded" (that's dispatch language); they see one line telling
 * them what's happening and what to do about it — never back-office detail
 * (queue position, who's been notified) the platform doesn't actually track.
 *
 * Only a subset of alert ids are translated here. Untranslated ids
 * (acceptance_delayed, transit_unusually_long) aren't actionable from where
 * the driver already is in the flow, so they're intentionally silent.
 */

const GUIDANCE_BY_ALERT_ID: Record<string, string> = {
  no_location_updates: "Your location hasn't updated recently. Check your network if possible.",
  pod_overdue: 'Delivery is taking longer than expected. Upload proof of delivery to complete this trip.',
  drop_dwell_exceeded: "Delivery is taking longer than expected. Wrap up when you're ready.",
  journey_behind_schedule: 'Running behind schedule. Continue toward the destination safely.',
  pickup_dwell_exceeded: 'Loading is taking longer than expected. Complete loading when ready.',
};

/** When more than one alert is active at once, only the single most useful line is shown. */
const GUIDANCE_PRIORITY = [
  'no_location_updates',
  'pod_overdue',
  'drop_dwell_exceeded',
  'journey_behind_schedule',
  'pickup_dwell_exceeded',
];

export function getDriverAlertGuidance(alerts: OperationalAlert[]): string | null {
  const activeIds = new Set(alerts.map((a) => a.id));
  for (const id of GUIDANCE_PRIORITY) {
    if (activeIds.has(id)) return GUIDANCE_BY_ALERT_ID[id];
  }
  return null;
}
