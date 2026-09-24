export type TripCommercialAdjustmentType =
  | "supplier_adjustment"
  | "brokerage_adjustment"
  | "penalty"
  | "rate_revision"
  | "detention"
  | "market_adjustment";

export type TripCommercialDirection =
  | "increase_cost"
  | "reduce_cost"
  | "increase_margin"
  | "reduce_margin";

export type TripCommercialPostingState = "unposted" | "posted";

export interface TripCommercialAdjustment {
  id: string;
  tripId: string;
  type: TripCommercialAdjustmentType;
  amount: number;
  direction: TripCommercialDirection;
  postingState: TripCommercialPostingState;
  createdAt: string;
}
