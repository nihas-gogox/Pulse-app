import type { OperationalPaymentOwner, ReimbursementState } from "../../../../../../features/trips/operations/types";

const TRANSITIONS: Record<ReimbursementState, ReadonlyArray<ReimbursementState>> = {
  reported: ["approved", "rejected"],
  approved: ["reimbursement_pending", "reimbursed", "rejected"],
  reimbursement_pending: ["reimbursed", "rejected"],
  reimbursed: [],
  rejected: [],
};

export function canTransitionReimbursementState(
  from: ReimbursementState,
  to: ReimbursementState,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function deriveInitialReimbursementState(
  paymentOwner: OperationalPaymentOwner,
): ReimbursementState {
  return paymentOwner === "driver" ? "reported" : "approved";
}

export function deriveReimbursementChipLabel(
  state: ReimbursementState,
): string {
  switch (state) {
    case "reported":
      return "Reported";
    case "approved":
      return "Approved";
    case "reimbursement_pending":
      return "Pending";
    case "reimbursed":
      return "Reimbursed";
    case "rejected":
      return "Rejected";
    default:
      return "Reported";
  }
}
