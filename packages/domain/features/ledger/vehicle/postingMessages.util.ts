export function describeVehiclePostingFailure(reason: string): string {
  switch (reason) {
    case "vehicle_missing":
    case "trip_missing":
      return "Assign a vehicle to this trip before posting expenses to the ledger.";
    case "payment_owner_unknown":
      return "Set who paid for this expense (driver, company, etc.) before posting.";
    case "insert_failed":
      return "Could not write this expense to the vehicle ledger. Try again.";
    case "aggregation_or_non_owned":
      return "Vehicle ledger posting is only available for owned asset trips.";
    case "posting_disabled":
      return "Vehicle ledger posting is disabled in this environment.";
    case "lookup_failed":
      return "Could not verify ledger state. Try again.";
    default:
      return `Could not post to ledger (${reason.replaceAll("_", " ")}).`;
  }
}

export function isVehiclePostingSuccess(reason: string, posted: boolean): boolean {
  return posted || reason === "already_posted";
}
