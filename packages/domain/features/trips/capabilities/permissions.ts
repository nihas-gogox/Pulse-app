import type { UserRole } from "../../auth/services/auth.service";

export interface ActorOperationalPermissions {
  canReportOperationalEvents: boolean;
  canApproveOperationalEvents: boolean;
  canSettleOperationalEvents: boolean;
  canPostAccountingImpact: boolean;
}

export function getActorOperationalPermissions(
  role: UserRole | null | undefined,
): ActorOperationalPermissions {
  const isDriver = role === "driver";
  if (isDriver) {
    return {
      canReportOperationalEvents: true,
      canApproveOperationalEvents: false,
      canSettleOperationalEvents: false,
      canPostAccountingImpact: false,
    };
  }
  return {
    canReportOperationalEvents: true,
    canApproveOperationalEvents: true,
    canSettleOperationalEvents: true,
    canPostAccountingImpact: true,
  };
}
