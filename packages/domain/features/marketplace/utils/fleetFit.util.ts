/**
 * Fleet-fit is presentation/ranking only — never a discovery or bid-eligibility
 * gate (see docs/MARKETPLACE_DOMAIN.md "Distribution vs monetization").
 * Shared between the Driver Fleet Owner "Find Work" feed and the Business
 * "Find Loads" feed so the same soft-match rule applies on both sides.
 */

/** Soft compatibility: true when a load's vehicle type loosely matches any owned vehicle type. */
export function isVehicleTypeCompatibleWithFleet(
  vehicleType: string | null | undefined,
  fleetVehicleTypes: Array<string | null | undefined>,
): boolean {
  const need = (vehicleType ?? '').trim().toLowerCase();
  if (!need) return true;
  const owned = fleetVehicleTypes
    .map((t) => (t ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (owned.length === 0) return true;
  return owned.some(
    (t) => t.includes(need) || need.includes(t) || shareToken(t, need),
  );
}

function shareToken(a: string, b: string): boolean {
  const ta = new Set(a.split(/[^a-z0-9]+/).filter((x) => x.length >= 3));
  const tb = b.split(/[^a-z0-9]+/).filter((x) => x.length >= 3);
  return tb.some((x) => ta.has(x));
}
