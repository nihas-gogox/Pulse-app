import { isIndianVehiclePlateComplete } from "@/lib/indianVehicleInput.util";

export type IndentAggregateStep =
  | "partner"
  | "rates"
  | "driverName"
  | "driverPhone"
  | "vehicleReg"
  | "commodity";

export type IndentAllocationStepId = "source" | "fleet" | IndentAggregateStep;

export type IndentWizardStep = { id: IndentAllocationStepId; label: string };

/**
 * Indent deploy steps — same shape as create-trip source then allocation.
 * Source is Asset vs Aggregate; fleet is grouped driver + vehicle (assign later is a switch).
 */
export function getIndentAllocationWizardSteps(opts: {
  aggregate: boolean;
  assignLater: boolean;
}): IndentWizardStep[] {
  const steps: IndentWizardStep[] = [{ id: "source", label: "Source" }];
  if (opts.aggregate) {
    steps.push({ id: "partner", label: "Partner" }, { id: "rates", label: "Rates" });
    if (!opts.assignLater) {
      steps.push(
        { id: "driverPhone", label: "Phone" },
        { id: "driverName", label: "Driver" },
        { id: "vehicleReg", label: "Vehicle" },
      );
    }
    steps.push({ id: "commodity", label: "Confirm" });
    return steps;
  }
  steps.push({ id: "fleet", label: "Fleet" });
  steps.push({ id: "commodity", label: "Confirm" });
  return steps;
}

export function indentAllocationStepSubtitle(
  step: IndentAllocationStepId,
  aggregate: boolean,
): string {
  switch (step) {
    case "source":
      return "Step 1 · How will this move";
    case "fleet":
      return "Assign vehicle and driver, or choose Assign later";
    case "partner":
      return "Select transport partner (supplier)";
    case "rates":
      return "Partner rate and advance";
    case "driverPhone":
      return "Driver mobile — we’ll suggest a name if they’re on Pulse";
    case "driverName":
      return "Driver name for tracking";
    case "vehicleReg":
      return "Vehicle number (e.g. TN 18 D 2522 or TN 17 AS 2202)";
    case "commodity":
      return "Confirm allocation and vehicle arrival date";
    default:
      return aggregate ? "Aggregate deploy" : "Asset deploy";
  }
}

export function isIndentAllocationStepComplete(
  step: IndentAllocationStepId,
  state: {
    assignDriverId: string | null;
    assignVehicleId: string | null | undefined;
    subcontractSupplierId: string | null;
    subcontractRate: string;
    aggregateDriverTrackingName: string;
    aggregateDriverPhone: string;
    assignVehicleRegistration: string;
    tripDetailsReady: boolean;
    aggregatePhoneInTrip: boolean;
    aggregatePhoneLookupLoading: boolean;
    aggregatePhoneMatches: readonly { user_id: string }[];
    aggregatePhoneSelectedUserId: string | null;
    staffHandshakeAssignLater: boolean;
  },
): boolean {
  switch (step) {
    case "source":
      return true;
    case "fleet":
      if (state.staffHandshakeAssignLater) return true;
      return !!state.assignDriverId && typeof state.assignVehicleId === "string";
    case "partner": {
      const sid = (state.subcontractSupplierId ?? "").trim();
      return sid.length > 0;
    }
    case "rates": {
      const rateRaw = state.subcontractRate.trim();
      const rateNum = Number(rateRaw);
      return rateRaw.length > 0 && Number.isFinite(rateNum) && rateNum >= 0;
    }
    case "driverName":
      return state.aggregateDriverTrackingName.trim().length > 0;
    case "driverPhone": {
      const last10 = state.aggregateDriverPhone.replace(/\D/g, "").slice(-10);
      if (last10.length < 10) return false;
      if (state.aggregatePhoneLookupLoading) return false;
      if (state.aggregatePhoneInTrip) return false;
      if (
        state.aggregatePhoneMatches.length > 1 &&
        !state.aggregatePhoneSelectedUserId
      ) {
        return false;
      }
      return true;
    }
    case "vehicleReg":
      return isIndianVehiclePlateComplete(state.assignVehicleRegistration);
    case "commodity":
      return state.tripDetailsReady;
    default:
      return false;
  }
}

/** Why Convert / Continue cannot proceed. Null when the step is complete. */
export function indentAllocationStepBlockReason(
  step: IndentAllocationStepId,
  state: {
    assignDriverId: string | null;
    assignVehicleId: string | null | undefined;
    subcontractSupplierId: string | null;
    subcontractRate: string;
    aggregateDriverTrackingName: string;
    aggregateDriverPhone: string;
    assignVehicleRegistration: string;
    tripDetailsReady: boolean;
    aggregatePhoneInTrip: boolean;
    aggregatePhoneLookupLoading: boolean;
    aggregatePhoneMatches: readonly { user_id: string }[];
    aggregatePhoneSelectedUserId: string | null;
    staffHandshakeAssignLater: boolean;
  },
): string | null {
  if (isIndentAllocationStepComplete(step, state)) return null;
  switch (step) {
    case "fleet":
      if (!state.assignDriverId) return "Select a driver from your fleet.";
      return "Select a vehicle from your fleet.";
    case "partner":
      return "Select the partner for this trip.";
    case "rates":
      return "Enter the rate you will pay this partner.";
    case "driverName":
      return "Enter the driver name.";
    case "driverPhone": {
      const last10 = state.aggregateDriverPhone.replace(/\D/g, "").slice(-10);
      if (last10.length < 10) return "Enter a 10-digit driver phone number.";
      if (state.aggregatePhoneLookupLoading) {
        return "Still checking this phone number. Wait a moment, then try again.";
      }
      if (state.aggregatePhoneInTrip) {
        return "This driver is already assigned to another open trip.";
      }
      if (
        state.aggregatePhoneMatches.length > 1 &&
        !state.aggregatePhoneSelectedUserId
      ) {
        return "More than one driver matches this phone. Pick the right one.";
      }
      return "Enter a valid driver phone number.";
    }
    case "vehicleReg":
      return "Enter a complete vehicle registration number.";
    case "commodity":
      return "Set a valid vehicle arrival date before converting.";
    default:
      return "This step is not finished.";
  }
}
