import { CenteredLoadingView } from '@/components/CenteredLoadingView';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useOptionalOrganization } from '@/contexts/OrganizationContext';
import { ROUTES } from '@/lib/routes';
import { routeStackScreenOptions } from '@/lib/routeStackOptions';
import { Redirect, Stack } from 'expo-router';

export default function ComplianceLayout() {
  const org = useOptionalOrganization();
  const auth = useOptionalAuth();

  if (org === undefined) {
    if (!auth?.sessionAttached) {
      return <Redirect href={ROUTES.SIGN_IN_DIRECT} />;
    }
    return <CenteredLoadingView />;
  }

  return <Stack screenOptions={routeStackScreenOptions} />;
}
