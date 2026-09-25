export interface VehicleEconomicsSnapshot {
  totalSpendInr: number;
  totalDistanceKm: number;
  costPerKm: number | null;
}

export function computeVehicleEconomics(input: {
  approvedSpendInr: number;
  distanceKm: number;
}): VehicleEconomicsSnapshot {
  const totalSpendInr = Math.max(0, Number(input.approvedSpendInr) || 0);
  const totalDistanceKm = Math.max(0, Number(input.distanceKm) || 0);
  return {
    totalSpendInr,
    totalDistanceKm,
    costPerKm: totalDistanceKm > 0 ? Number((totalSpendInr / totalDistanceKm).toFixed(2)) : null,
  };
}
