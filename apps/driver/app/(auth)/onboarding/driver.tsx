// Legacy route name → /onboarding (see lib/routes.ts LEGACY_ROUTE_ALIASES).
import { LegacyRouteRedirect } from '../../../components/LegacyRouteRedirect';
import { DRIVER_ROUTES } from '../../../lib/routes';

export default function LegacyDriverOnboardingRoute() {
  return <LegacyRouteRedirect to={DRIVER_ROUTES.ONBOARDING} />;
}
