import type { TripFuelEntry, TripTollEntry } from "@/features/trips/operations/types";

export interface OperationalCashflowSnapshot {
  totalDriverPaidInr: number;
  totalOrganizationPaidInr: number;
  totalSupplierPaidInr: number;
  pendingSettlementInr: number;
}

export function deriveOperationalCashflow(input: {
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
}): OperationalCashflowSnapshot {
  const rows = [...input.fuelEntries, ...input.tollEntries];
  let totalDriverPaidInr = 0;
  let totalOrganizationPaidInr = 0;
  let totalSupplierPaidInr = 0;
  let pendingSettlementInr = 0;
  for (const row of rows) {
    const amount = Math.max(0, Number(row.amount_inr ?? 0) || 0);
    const owner = String(row.payment_owner ?? "").toLowerCase();
    if (owner === "driver") totalDriverPaidInr += amount;
    else if (owner === "organization" || owner === "fleet_card") {
      totalOrganizationPaidInr += amount;
    } else if (owner === "supplier") {
      totalSupplierPaidInr += amount;
    } else {
      pendingSettlementInr += amount;
    }
  }
  return {
    totalDriverPaidInr: Math.round(totalDriverPaidInr * 100) / 100,
    totalOrganizationPaidInr: Math.round(totalOrganizationPaidInr * 100) / 100,
    totalSupplierPaidInr: Math.round(totalSupplierPaidInr * 100) / 100,
    pendingSettlementInr: Math.round(pendingSettlementInr * 100) / 100,
  };
}
