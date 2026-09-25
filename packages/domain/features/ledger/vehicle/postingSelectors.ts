import type { TripFuelEntry } from "../../trips/operations/types";

export interface FuelPostingCandidate {
  sourceType: "fuel";
  sourceId: string;
  amount: number;
  tripId: string;
  paymentOwner: TripFuelEntry["payment_owner"];
  approvalState: TripFuelEntry["approval_state"];
  ledgerState: TripFuelEntry["ledger_state"];
}

export function toFuelPostingCandidate(entry: TripFuelEntry): FuelPostingCandidate {
  return {
    sourceType: "fuel",
    sourceId: entry.id,
    amount: Math.max(0, Number(entry.amount_inr) || 0),
    tripId: entry.trip_id,
    paymentOwner: entry.payment_owner,
    approvalState: entry.approval_state,
    ledgerState: entry.ledger_state,
  };
}
