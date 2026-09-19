/**
 * Bidders often receive a market-RPC indent that has supplier_target but no
 * supplier_rate_basis (that column is not on market_indents_for_org). Without
 * a basis, a ₹/MT target is shown as a trip total. The broadcast RPC is the
 * one that still projects the basis.
 */
export type BidderIndentTargetSlice = {
  supplier_target?: number | null;
  supplier_rate_basis?: string | null;
  weight?: number | null;
};

export type BroadcastIndentTargetSlice = {
  supplier_target: number | null;
  supplier_rate_basis: "per_mt" | "per_trip" | null;
  weight: number | null;
};

export function indentHasSaleRateBasis(
  basis: string | null | undefined,
): basis is "per_mt" | "per_trip" {
  return basis === "per_mt" || basis === "per_trip";
}

/** True when the visible indent cannot price a bid without the broadcast RPC. */
export function bidderIndentNeedsBroadcastFallback(
  indent: BidderIndentTargetSlice | null | undefined,
): boolean {
  const hasTarget = Number(indent?.supplier_target ?? 0) > 0;
  return !hasTarget || !indentHasSaleRateBasis(indent?.supplier_rate_basis);
}

export function mergeBidderIndentTarget<T extends BidderIndentTargetSlice>(
  indent: T | null,
  broadcast: BroadcastIndentTargetSlice | null,
): T | (T & BroadcastIndentTargetSlice) | null {
  if (!broadcast) return indent;
  return {
    ...(indent ?? ({} as T)),
    supplier_target:
      broadcast.supplier_target ?? indent?.supplier_target ?? null,
    supplier_rate_basis:
      broadcast.supplier_rate_basis ?? indent?.supplier_rate_basis ?? null,
    weight: broadcast.weight ?? indent?.weight ?? null,
  };
}
