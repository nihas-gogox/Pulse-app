/**
 * Forwards an old in-app driver route name to its contract URL, keeping all params
 * (lib/routes.ts LEGACY_ROUTE_ALIASES). The driver screens are unchanged and still push
 * the old names, because the same code also runs in the main app's old flow until 4C.
 */
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export function LegacyRouteRedirect({ to }: { to: string }) {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: to, params } as Href} />;
}
