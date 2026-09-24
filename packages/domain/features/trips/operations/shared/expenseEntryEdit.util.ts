import type { TripCostEvent } from "../../../finance/domain/tripCostEvent";
import type { OperationalPaymentOwner, ReimbursementState } from "../types";

export function canEditTripCostEvent(event: TripCostEvent): boolean {
  if (event.postingState === "posted") return false;
  if (event.settlementState === "settled") return false;
  return true;
}

export function buildExpenseEditApprovalReset(
  paymentOwner: OperationalPaymentOwner,
): Record<string, unknown> {
  const reimbursementState: ReimbursementState =
    paymentOwner === "driver" ? "reported" : "approved";
  return {
    approval_state: "review_pending",
    posting_state: "pending",
    posting_error: null,
    ledger_state: "not_posted",
    approved_by: null,
    approved_at: null,
    reimbursement_state: reimbursementState,
    reimbursement_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
