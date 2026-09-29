/**
 * Resolve supplier label + truck type for Compliance list cards the same way
 * Trip Detail / payment confirm do: owned vehicle first, then
 * `get_vehicle_for_trip_viewer` for partner trucks; supplier via id lookup.
 */
import { getSupplierById, getSupplierDetails } from "@/features/suppliers/services/suppliers.service";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { getTripExecutionModel } from "@/features/trips/domain/tripExecutionModel";
import { getVehicleById, getVehicleForTripViewer } from "@/features/vehicles/services/vehicles.service";
import { useEffect, useMemo, useState } from "react";

export type ComplianceListTripFacts = {
  truckTypeByVehicleId: Record<string, string>;
  supplierNameByTripId: Record<string, string>;
};

function supplierLabelFromRow(row: {
  name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
} | null): string {
  if (!row) return "";
  return (row.name ?? row.company_name ?? row.contact_person ?? "").trim();
}

export function useComplianceListTripFacts(
  summaries: ComplianceTripSummary[],
  viewerOrgId: string,
): ComplianceListTripFacts {
  const [truckTypeByVehicleId, setTruckTypeByVehicleId] = useState<Record<string, string>>({});
  const [supplierNameByTripId, setSupplierNameByTripId] = useState<Record<string, string>>({});

  const signature = useMemo(() => {
    return summaries
      .map((s) =>
        [
          s.trip.id,
          s.trip.vehicle_id ?? "",
          s.trip.supplier_id ?? "",
          s.trip.organization_id ?? "",
          getTripExecutionModel(s.trip),
        ].join(":"),
      )
      .join("|");
  }, [summaries]);

  useEffect(() => {
    let cancelled = false;
    if (!viewerOrgId || summaries.length === 0) {
      setTruckTypeByVehicleId({});
      setSupplierNameByTripId({});
      return;
    }

    const vehicleJobs = new Map<
      string,
      { vehicleId: string; tripId: string; tripOrgId: string }
    >();
    const supplierJobs = new Map<
      string,
      { tripId: string; supplierId: string; tripOrgId: string; isAsset: boolean }
    >();

    for (const summary of summaries) {
      const trip = summary.trip;
      const tripId = trip.id;
      const tripOrgId = (trip.organization_id ?? viewerOrgId).trim();
      const vehicleId = trip.vehicle_id?.trim() ?? "";
      const supplierId = trip.supplier_id?.trim() ?? "";
      const isAsset = getTripExecutionModel(trip) === "asset";

      if (vehicleId && !vehicleJobs.has(vehicleId)) {
        vehicleJobs.set(vehicleId, { vehicleId, tripId, tripOrgId });
      }

      if (isAsset && !supplierId) {
        supplierJobs.set(tripId, { tripId, supplierId: "", tripOrgId, isAsset: true });
      } else if (supplierId) {
        supplierJobs.set(tripId, { tripId, supplierId, tripOrgId, isAsset: false });
      } else {
        supplierJobs.set(tripId, { tripId, supplierId: "", tripOrgId, isAsset: false });
      }
    }

    void (async () => {
      const nextTrucks: Record<string, string> = {};
      const nextSuppliers: Record<string, string> = {};

      await Promise.all(
        Array.from(vehicleJobs.values()).map(async ({ vehicleId, tripId, tripOrgId }) => {
          const owned = await getVehicleById(tripOrgId, vehicleId);
          let type = owned.vehicle?.vehicle_type?.trim() || "";
          if (!type && tripOrgId !== viewerOrgId) {
            const ownedViewer = await getVehicleById(viewerOrgId, vehicleId);
            type = ownedViewer.vehicle?.vehicle_type?.trim() || "";
          }
          if (!type) {
            const shared = await getVehicleForTripViewer(vehicleId, tripId, viewerOrgId);
            type = shared.vehicle?.vehicle_type?.trim() || "";
          }
          if (!type && tripOrgId !== viewerOrgId) {
            const sharedOwner = await getVehicleForTripViewer(vehicleId, tripId, tripOrgId);
            type = sharedOwner.vehicle?.vehicle_type?.trim() || "";
          }
          if (type) nextTrucks[vehicleId] = type;
        }),
      );

      await Promise.all(
        Array.from(supplierJobs.values()).map(async ({ tripId, supplierId, tripOrgId, isAsset }) => {
          if (isAsset && !supplierId) {
            nextSuppliers[tripId] = "Own fleet";
            return;
          }
          if (!supplierId) {
            nextSuppliers[tripId] = "—";
            return;
          }
          let label = "";
          const details = await getSupplierDetails(supplierId);
          label = supplierLabelFromRow(details.supplier);
          if (!label) {
            const owner = await getSupplierById(tripOrgId, supplierId);
            label = supplierLabelFromRow(owner.supplier);
          }
          if (!label && viewerOrgId !== tripOrgId) {
            const viewer = await getSupplierById(viewerOrgId, supplierId);
            label = supplierLabelFromRow(viewer.supplier);
          }
          nextSuppliers[tripId] = label || "—";
        }),
      );

      if (!cancelled) {
        setTruckTypeByVehicleId(nextTrucks);
        setSupplierNameByTripId(nextSuppliers);
      }
    })();

    return () => {
      cancelled = true;
    };
    // signature captures the trip fields we care about
    // eslint-disable-next-line react-hooks/exhaustive-deps -- summaries keyed via signature
  }, [signature, viewerOrgId]);

  return { truckTypeByVehicleId, supplierNameByTripId };
}
