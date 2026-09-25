export type VehicleExpenseCategory =
  | "emi"
  | "insurance"
  | "permit"
  | "fitness"
  | "maintenance"
  | "service"
  | "tire"
  | "oil"
  | "tax"
  | "gps"
  | "fastag"
  | "depreciation"
  | "misc";

export type VehicleExpenseScope = "common" | "trip_specific";

export interface VehicleExpenseEvent {
  id: string;
  vehicleId: string;
  category: VehicleExpenseCategory;
  amount: number;
  expenseScope: VehicleExpenseScope;
  linkedTripId?: string;
  approvalState: "pending" | "approved" | "rejected";
  postingState: "unposted" | "posted" | "failed";
  settlementState: "unpaid" | "partial" | "settled";
  ledgerTransactionId?: string;
  affectsVehiclePnL: boolean;
  affectsTripPnL: boolean;
  allocationStrategy?: "none" | "km_based" | "trip_based" | "time_based";
  allocationStatus?: "unallocated" | "partial" | "allocated";
  allocatedAmount?: number;
  createdAt: string;
}
