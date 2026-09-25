/**
 * Recommended actions per alert type — metadata, not a workflow engine.
 * getAlertActions() returns what an operator *could* do; whether each one is
 * actually wired up depends on real capabilities that exist today, decided
 * by the caller (does this trip have a driver phone number? does trip-
 * specific dispatcher chat deep-linking exist?), not invented here.
 *
 * Investigated before wiring anything, per "only wire what's real":
 *  - Open Trip: real (ROUTES.tripDetail).
 *  - Call Driver: real IF a phone number exists for the trip's driver —
 *    data-dependent, not a capability gap.
 *  - Message Driver: NOT wired. The dispatcher /chat route only redirects
 *    drivers to their own screen; it does not deep-link to a specific
 *    trip's conversation the way the driver-side /(driver)/chat?tripId= does.
 *    That's a real, fixable gap, not something to paper over with a generic
 *    "go to your inbox" link that wouldn't actually resolve the alert faster.
 *  - Notify Customer, Escalate: no implementation exists at all.
 */

import type { OperationalAlert } from "./tripOperationalAlerts";

export type AlertActionKind = "navigate" | "call" | "message" | "notify" | "escalate";

export interface AlertAction {
  id: string;
  label: string;
  kind: AlertActionKind;
}

const ACTIONS_BY_ALERT_ID: Record<string, AlertAction[]> = {
  acceptance_delayed: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "call_driver", label: "Call Driver", kind: "call" },
    { id: "message_driver", label: "Message Driver", kind: "message" },
  ],
  pickup_dwell_exceeded: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "call_driver", label: "Call Driver", kind: "call" },
    { id: "escalate", label: "Escalate", kind: "escalate" },
  ],
  transit_unusually_long: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "message_driver", label: "Message Driver", kind: "message" },
    { id: "notify_customer", label: "Notify Customer", kind: "notify" },
  ],
  journey_behind_schedule: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "call_driver", label: "Call Driver", kind: "call" },
    { id: "message_driver", label: "Message Driver", kind: "message" },
  ],
  drop_dwell_exceeded: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "call_driver", label: "Call Driver", kind: "call" },
  ],
  pod_overdue: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "message_driver", label: "Message Driver", kind: "message" },
  ],
  no_location_updates: [
    { id: "open_trip", label: "Open Trip", kind: "navigate" },
    { id: "call_driver", label: "Call Driver", kind: "call" },
  ],
};

/**
 * Capability matrix — the single source of truth for which action kinds are
 * real today and, for the ones that aren't, exactly what unlocks them. Read
 * this before wiring a new action kind rather than re-deriving availability
 * from dashboard code; when one of these capabilities gets built, this is
 * the one place to flip from "requires_capability" to "available".
 */
export type AlertActionCapabilityStatus = "available" | "requires_capability";

export interface AlertActionCapability {
  kind: AlertActionKind;
  status: AlertActionCapabilityStatus;
  /** Only present when status is "requires_capability" — what would need to exist first. */
  requires?: string;
}

export const ALERT_ACTION_CAPABILITIES: Record<AlertActionKind, AlertActionCapability> = {
  navigate: { kind: "navigate", status: "available" },
  call: {
    kind: "call",
    status: "available",
    requires: "A phone number on file for the trip's driver — data-dependent per trip, not a capability gap",
  },
  message: {
    kind: "message",
    status: "requires_capability",
    requires:
      "Dispatcher-side trip-specific chat deep link — ChatRouteContent/ChatScreen would need to read and apply the tripId param the way /(driver)/chat?tripId= already does for drivers",
  },
  notify: {
    kind: "notify",
    status: "requires_capability",
    requires: "A customer notification channel (SMS/email/push) — none exists yet",
  },
  escalate: {
    kind: "escalate",
    status: "requires_capability",
    requires: "An escalation workflow (e.g. assign to a supervisor, open a ticket) — none exists yet",
  },
};

/** Kinds with no real implementation behind them yet anywhere in the app. */
export const UNAVAILABLE_ACTION_KINDS: ReadonlySet<AlertActionKind> = new Set(
  Object.values(ALERT_ACTION_CAPABILITIES)
    .filter((c) => c.status === "requires_capability")
    .map((c) => c.kind),
);

export function getAlertActions(alert: OperationalAlert): AlertAction[] {
  return ACTIONS_BY_ALERT_ID[alert.id] ?? [{ id: "open_trip", label: "Open Trip", kind: "navigate" }];
}
