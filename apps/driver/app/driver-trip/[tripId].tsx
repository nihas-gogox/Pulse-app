// Legacy route name → /trip/[tripId] (see lib/routes.ts LEGACY_ROUTE_ALIASES).
import { LegacyRouteRedirect } from '../../components/LegacyRouteRedirect';

export default function LegacyDriverTripRoute() {
  return <LegacyRouteRedirect to="/trip/[tripId]" />;
}
