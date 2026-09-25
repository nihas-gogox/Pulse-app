// Types extracted from lib/capabilities.ts (driver extraction, Phase 2, D19). Types only — no runtime code.

/**
 * Capability-based access for unified user role.
 * Aligned with pulse-unified-base src/lib/capabilities.ts.
 */

export type Capability =
  | "fleet_management"
  | "dispatch"
  | "dispatch_for_own_fleet"
  | "marketplace_post"
  | "marketplace_bid"
  | "finance_view"
  | "finance_manage"
  | "team_manage";
