import type { TripCostEvent } from "../../../finance/domain/tripCostEvent";

export function isDriverReimbursementCostEvent(event: TripCostEvent): boolean {
  return event.incurredBy === "driver" && event.reimbursable;
}

export function isDriverSubmittedOperationalExpense(row: {
  payment_owner?: string | null;
  approval_state?: string | null;
  reimbursement_state?: string | null;
}): boolean {
  if (String(row.payment_owner ?? "").toLowerCase() === "driver") return true;
  const approval = String(row.approval_state ?? "").toLowerCase();
  const reimbursement = String(row.reimbursement_state ?? "").toLowerCase();
  return approval === "reported" && reimbursement === "reported";
}
