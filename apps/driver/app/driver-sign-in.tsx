// Legacy route name → /sign-in (see lib/routes.ts LEGACY_ROUTE_ALIASES).
import { LegacyRouteRedirect } from '../components/LegacyRouteRedirect';
import { DRIVER_ROUTES } from '../lib/routes';

export default function LegacyDriverSignInRoute() {
  return <LegacyRouteRedirect to={DRIVER_ROUTES.SIGN_IN} />;
}
