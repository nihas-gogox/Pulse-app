/**
 * Pulse Driver navigation-policy registry (driver extraction, Phase 3).
 * Based on the main app's lib/navigationPolicy/registry/driver.ts: same ids, patterns
 * and priorities for the (driver) group. The one change is Trip Detail, whose route is
 * now /trip/:tripId (was /driver-trip/:tripId). Public auth pages and the legacy
 * redirect routes are listed so every route file in apps/driver/app has a policy
 * (enforced by lib/__tests__/driverRoutePolicies.test.ts).
 *
 * Self-contained on purpose: the main app's policy engine/types are main-only code.
 */
export type DriverPolicyRecord = {
  id: string;
  /** Route pattern with groups, e.g. '/(driver)/wallet', ':param' for dynamic segments. */
  pattern: string;
  experience: 'driver' | 'public';
  priority: number;
  onDeny: { type: 'experience_home'; experience: 'driver' } | { type: 'sign_in' };
};

const driver = (id: string, pattern: string, priority = 90): DriverPolicyRecord => ({
  id,
  pattern,
  experience: 'driver',
  priority,
  onDeny: { type: 'experience_home', experience: 'driver' },
});
const pub = (id: string, pattern: string): DriverPolicyRecord => ({
  id,
  pattern,
  experience: 'public',
  priority: 100,
  onDeny: { type: 'sign_in' },
});

export const DRIVER_APP_POLICIES: readonly DriverPolicyRecord[] = [
  driver('driver.home', '/(driver)', 100),
  driver('driver.wallet', '/(driver)/wallet'),
  driver('driver.stories', '/(driver)/stories'),
  driver('driver.chat', '/(driver)/chat'),
  driver('driver.control', '/(driver)/control'),
  driver('driver.documents', '/(driver)/documents'),
  driver('driver.level-progression', '/(driver)/level-progression'),
  driver('driver.notifications', '/(driver)/notifications'),
  driver('driver.pending-earnings', '/(driver)/pending-earnings'),
  driver('driver.profile', '/(driver)/profile'),
  driver('driver.requests', '/(driver)/requests'),
  driver('driver.settings', '/(driver)/settings'),
  driver('driver.passbook-history', '/(driver)/passbook/history'),
  driver('driver.passbook-org', '/(driver)/passbook/:orgId', 80),
  driver('driver.salary-request', '/(driver)/salary-request'),
  driver('driver.salary-request-id', '/(driver)/salary-request/:id', 80),
  driver('driver.trip-history', '/(driver)/trip-history'),
  driver('driver.trip-detail', '/trip/:tripId', 80),
  driver('driver.expense-capture', '/(driver)/expense-capture'),
  driver('driver.general-expense', '/(driver)/general-expense'),
  driver('driver.become-fleet-owner', '/(driver)/become-fleet-owner'),
  driver('driver.dco-status', '/(driver)/dco-status'),
  driver('driver.my-fleet', '/(driver)/my-fleet'),
  driver('driver.my-fleet-add', '/(driver)/my-fleet/add'),
  driver('driver.my-fleet-vehicle', '/(driver)/my-fleet/:vehicleId', 80),
  driver('driver.available-loads', '/(driver)/available-loads'),
  driver('driver.available-load', '/(driver)/available-loads/:indentId', 80),
  driver('driver.capacity-story', '/(driver)/capacity-story'),
  // Present in the (driver) group but absent from the main registry; same defaults.
  driver('driver.my-bids', '/(driver)/my-bids'),
  driver('driver.market-awards', '/(driver)/market-awards'),
  driver('driver.commerce-mission', '/(driver)/commerce-mission/:tripId', 80),
  // Public auth pages (contract URLs) and the legacy redirects to them.
  pub('driver.sign-in', '/(auth)/sign-in'),
  pub('driver.sign-up', '/(auth)/sign-up'),
  pub('driver.onboarding', '/(auth)/onboarding'),
  pub('driver.legacy.sign-in', '/driver-sign-in'),
  pub('driver.legacy.sign-up', '/driver-signup'),
  pub('driver.legacy.onboarding', '/(auth)/onboarding/driver'),
  driver('driver.legacy.trip-detail', '/driver-trip/:tripId', 80),
];
