import type { TripFuelEntry, TripTollEntry } from "../../trips/operations/types";

export interface OperationalPayablesProjection {
  driverReimbursementPayableInr: number;
  supplierOperationalPayableInr: number;
  unclassifiedOperationalPayableInr: number;
}

export function deriveOperationalPayables(input: {
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
}): OperationalPayablesProjection {
  const rows = [...input.fuelEntries, ...input.tollEntries];
  let driverReimbursementPayableInr = 0;
  let supplierOperationalPayableInr = 0;
  let unclassifiedOperationalPayableInr = 0;
  for (const row of rows) {
    const amount = Math.max(0, Number(row.amount_inr ?? 0) || 0);
    const owner = String(row.payment_owner ?? "").toLowerCase();
    const reimbursement = String(row.reimbursement_state ?? "").toLowerCase();
    if (owner === "driver") {
      if (
        reimbursement === "reported" ||
        reimbursement === "approved" ||
        reimbursement === "reimbursement_pending"
      ) {
        driverReimbursementPayableInr += amount;
      }
    } else if (owner === "supplier") {
      supplierOperationalPayableInr += amount;
    } else if (owner !== "organization" && owner !== "fleet_card") {
      unclassifiedOperationalPayableInr += amount;
    }
  }
  return {
    driverReimbursementPayableInr: Math.round(driverReimbursementPayableInr * 100) / 100,
    supplierOperationalPayableInr: Math.round(supplierOperationalPayableInr * 100) / 100,
    unclassifiedOperationalPayableInr: Math.round(unclassifiedOperationalPayableInr * 100) / 100,
  };
}
