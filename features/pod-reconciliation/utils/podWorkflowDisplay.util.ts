/**
 * Frontend-only POD workflow display helpers.
 * Derives labels, next actions, and timeline steps from existing trip fields.
 * Never writes to the backend or invents stored status values.
 */
import { tripIsDeliveredStatus } from "@/features/trips/services/tripDocumentLrPod.service";
import type { PodReconciliationTripView } from "../services/podReconciliationService";

export type PodDisplayStatus =
  | "pod_pending"
  | "soft_pod_uploaded"
  | "hard_pod_pending"
  | "under_verification"
  | "pod_verified"
  | "ready_for_invoice"
  | "invoiced";

export type PodNextActionKind =
  | "upload_pod"
  | "upload_hard_pod"
  | "review_pod"
  | "replace_pod"
  | "view_pod"
  | "create_invoice"
  | "view_invoice";

export type PodTimelineStepId =
  | "trip_completed"
  | "soft_pod"
  | "hard_pod"
  | "verification"
  | "ready_for_invoice"
  | "invoiced";

export type PodTimelineStepState = "done" | "current" | "upcoming";

export type PodTimelineStep = {
  id: PodTimelineStepId;
  label: string;
  state: PodTimelineStepState;
};

export type PodNextAction = {
  kind: PodNextActionKind;
  label: string;
  /** Existing app surface this action opens. */
  handler: "log_incoming" | "review" | "invoicing" | "drawer";
  tone: "urgent" | "attention" | "positive" | "neutral";
};

const STATUS_LABELS: Record<PodDisplayStatus, string> = {
  pod_pending: "POD Pending",
  soft_pod_uploaded: "Soft POD Uploaded",
  hard_pod_pending: "Hard POD Pending",
  under_verification: "Under Verification",
  pod_verified: "POD Verified",
  ready_for_invoice: "Ready for Invoice",
  invoiced: "Invoiced",
};

export function podDisplayStatusLabel(status: PodDisplayStatus): string {
  return STATUS_LABELS[status];
}

function isInvoiced(trip: PodReconciliationTripView): boolean {
  if ((trip.invoice_no || "").trim()) return true;
  const display = (trip.invoice_status_display || "").toLowerCase();
  if (display === "invoiced") return true;
  const inv1 = (trip.invoice_status_1 || "").toLowerCase();
  return inv1.includes("raised");
}

function isReadyForInvoice(trip: PodReconciliationTripView): boolean {
  return (trip.invoice_status_display || "").toLowerCase() === "ready for invoice";
}

function isNeedsActionQueue(trip: PodReconciliationTripView): boolean {
  const display = (trip.invoice_status_display || "").toLowerCase();
  return display === "received";
}

/**
 * Derive a human-readable POD workflow state from fields already on the trip view.
 */
export function derivePodDisplayStatus(
  trip: PodReconciliationTripView,
): PodDisplayStatus {
  if (isInvoiced(trip)) return "invoiced";
  if (isReadyForInvoice(trip)) return "ready_for_invoice";

  const soft = Boolean(trip.soft_pod_received);
  const hard = Boolean(trip.hard_pod_received);

  if (hard) {
    if (isNeedsActionQueue(trip)) return "under_verification";
    return "pod_verified";
  }

  if (soft) return "soft_pod_uploaded";

  // Soft missing + hard missing. Prefer action-oriented "Hard POD Pending"
  // only when the trip is already completed; otherwise plain POD Pending.
  if (tripIsDeliveredStatus(trip.trip_status)) return "hard_pod_pending";
  return "pod_pending";
}

/**
 * One clear next action wired to existing screens/modals only.
 */
export function derivePodNextAction(
  trip: PodReconciliationTripView,
): PodNextAction {
  const status = derivePodDisplayStatus(trip);

  switch (status) {
    case "invoiced":
      return {
        kind: "view_invoice",
        label: "View Invoice",
        handler: "invoicing",
        tone: "neutral",
      };
    case "ready_for_invoice":
      return {
        kind: "create_invoice",
        label: "Create Invoice",
        handler: "invoicing",
        tone: "positive",
      };
    case "under_verification":
      return {
        kind: "review_pod",
        label: "Review POD",
        handler: "review",
        tone: "attention",
      };
    case "pod_verified":
      return {
        kind: "view_pod",
        label: "View POD",
        handler: "review",
        tone: "neutral",
      };
    case "soft_pod_uploaded":
      return {
        kind: "upload_hard_pod",
        label: "Upload Hard POD",
        handler: "log_incoming",
        tone: "urgent",
      };
    case "hard_pod_pending":
      return softOrUpload(trip);
    case "pod_pending":
    default:
      return softOrUpload(trip);
  }
}

function softOrUpload(trip: PodReconciliationTripView): PodNextAction {
  if (trip.soft_pod_received) {
    return {
      kind: "replace_pod",
      label: "Replace POD",
      handler: "log_incoming",
      tone: "attention",
    };
  }
  return {
    kind: "upload_pod",
    label: "Upload POD",
    handler: "log_incoming",
    tone: "urgent",
  };
}

/**
 * Visual progress for the drawer. States are display-only.
 */
export function derivePodTimeline(
  trip: PodReconciliationTripView,
): PodTimelineStep[] {
  const tripDone = tripIsDeliveredStatus(trip.trip_status);
  const soft = Boolean(trip.soft_pod_received);
  const hard = Boolean(trip.hard_pod_received);
  const verified = hard; // hard copy stamp is the existing verification gate
  const ready = isReadyForInvoice(trip) || isInvoiced(trip);
  const invoiced = isInvoiced(trip);

  const flags: Record<PodTimelineStepId, boolean> = {
    trip_completed: tripDone,
    soft_pod: soft,
    hard_pod: hard,
    verification: verified,
    ready_for_invoice: ready,
    invoiced,
  };

  const order: PodTimelineStepId[] = [
    "trip_completed",
    "soft_pod",
    "hard_pod",
    "verification",
    "ready_for_invoice",
    "invoiced",
  ];

  const labels: Record<PodTimelineStepId, string> = {
    trip_completed: "Trip Completed",
    soft_pod: "Soft POD",
    hard_pod: "Hard POD",
    verification: "POD Verification",
    ready_for_invoice: "Ready for Invoice",
    invoiced: "Invoiced",
  };

  let foundCurrent = false;
  return order.map((id) => {
    const done = flags[id];
    let state: PodTimelineStepState;
    if (done) {
      state = "done";
    } else if (!foundCurrent) {
      state = "current";
      foundCurrent = true;
    } else {
      state = "upcoming";
    }
    return { id, label: labels[id], state };
  });
}

export function podActionToneColor(tone: PodNextAction["tone"]): string {
  switch (tone) {
    case "urgent":
      return "#b00020";
    case "attention":
      return "#b45309";
    case "positive":
      return "#059669";
    default:
      return "#4D3636";
  }
}

export function podStatusToneColor(status: PodDisplayStatus): string {
  switch (status) {
    case "pod_pending":
    case "hard_pod_pending":
      return "#b00020";
    case "soft_pod_uploaded":
    case "under_verification":
      return "#b45309";
    case "pod_verified":
    case "ready_for_invoice":
      return "#059669";
    case "invoiced":
    default:
      return "#4D3636";
  }
}
