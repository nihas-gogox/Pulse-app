/**
 * When an awarded supplier deploys a shipper-owned trip to their own partner,
 * the partner lives on trip_subcontracts (viewer org), not trips.supplier_id
 * (that column is the shipper's payable to the awarded org).
 * Overlay the subcontract so Finance / trip detail / hub show the partner.
 */
export type ViewerTripSubcontractOverlay = {
  supplier_id: string;
  rate: number;
};

export function overlayViewerTripSubcontract<
  T extends {
    organization_id?: string | null;
    supplier_id?: string | null;
    supplier_rate?: number | null;
    supplier_name?: string | null;
  },
>(
  trip: T,
  viewerOrgId: string | null,
  subcontract: ViewerTripSubcontractOverlay | undefined,
  supplierDisplayName?: string | null,
  opts?: { applyRate?: boolean },
): T {
  if (!subcontract?.supplier_id) return trip;
  const isOwner =
    Boolean(viewerOrgId) &&
    Boolean(trip.organization_id) &&
    trip.organization_id === viewerOrgId;
  const ownSupplierId = String(trip.supplier_id ?? "").trim();
  if (isOwner && ownSupplierId) return trip;
  const name = (supplierDisplayName ?? "").trim();
  return {
    ...trip,
    supplier_id: subcontract.supplier_id,
    ...(opts?.applyRate
      ? { supplier_rate: Number(subcontract.rate) || 0 }
      : {}),
    supplier_name: name || trip.supplier_name || null,
  };
}
