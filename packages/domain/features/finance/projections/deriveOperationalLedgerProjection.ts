import type { TripFuelEntry, TripTollEntry } from "@/features/trips/operations/types";

export interface OperationalLedgerProjection {
  approvedToPostCount: number;
  postedCount: number;
  failedPostingCount: number;
  approvalPendingCount: number;
  totalApprovedExpenseInr: number;
}

export function deriveOperationalLedgerProjection(input: {
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
}): OperationalLedgerProjection {
  const rows = [...input.fuelEntries, ...input.tollEntries];
  let approvedToPostCount = 0;
  let postedCount = 0;
  let failedPostingCount = 0;
  let approvalPendingCount = 0;
  let totalApprovedExpenseInr = 0;
  for (const row of rows) {
    const approvalState = String(row.approval_state ?? "").toLowerCase();
    const postingState = String(row.posting_state ?? "").toLowerCase();
    if (approvalState === "reported" || approvalState === "review_pending") {
      approvalPendingCount += 1;
      continue;
    }
    if (approvalState === "approved" || approvalState === "settled") {
      totalApprovedExpenseInr += Math.max(0, Number(row.amount_inr ?? 0) || 0);
      if (postingState === "posted") postedCount += 1;
      else if (postingState === "failed") failedPostingCount += 1;
      else approvedToPostCount += 1;
    }
  }
  return {
    approvedToPostCount,
    postedCount,
    failedPostingCount,
    approvalPendingCount,
    totalApprovedExpenseInr: Math.round(totalApprovedExpenseInr * 100) / 100,
  };
}
