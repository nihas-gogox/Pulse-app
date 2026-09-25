import type { TripFuelEntry, TripTollEntry } from "../../trips/operations/types";

export interface PendingReimbursementProjection {
  pendingCount: number;
  pendingAmountInr: number;
  reimbursedCount: number;
  rejectedCount: number;
}

export function derivePendingReimbursements(input: {
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
}): PendingReimbursementProjection {
  const rows = [...input.fuelEntries, ...input.tollEntries].filter(
    (row) => String(row.payment_owner ?? "").toLowerCase() === "driver",
  );
  let pendingCount = 0;
  let pendingAmountInr = 0;
  let reimbursedCount = 0;
  let rejectedCount = 0;
  for (const row of rows) {
    const state = String(row.reimbursement_state ?? "").toLowerCase();
    const amount = Math.max(0, Number(row.amount_inr ?? 0) || 0);
    if (state === "reimbursed") reimbursedCount += 1;
    else if (state === "rejected") rejectedCount += 1;
    else if (
      state === "reported" ||
      state === "approved" ||
      state === "reimbursement_pending"
    ) {
      pendingCount += 1;
      pendingAmountInr += amount;
    }
  }
  return {
    pendingCount,
    pendingAmountInr: Math.round(pendingAmountInr * 100) / 100,
    reimbursedCount,
    rejectedCount,
  };
}
