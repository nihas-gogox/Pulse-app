import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { PartyRegistrationPortal } from '@/features/finance/components/PartyRegistrationPortal';
import { usePartyPortalRouteHandlers } from '@/features/finance/hooks/usePartyPortalRouteHandlers';
import { canAccessVehicles } from '@/lib/capabilities';
import { useCapabilities } from '@/lib/useCapabilities';
import { useMemberAccess } from '@/lib/useMemberAccess';
import { ROUTES } from '@/lib/routes';
import { performSafeBack } from '@/lib/useSafeBack';

const DEFAULT_FALLBACK_ROUTE = ROUTES.TABS.RESOURCES;

/** Dismiss modal: go back to the page that opened it. */
function closeModal(router: ReturnType<typeof useRouter>, returnTo?: string) {
  performSafeBack(router, returnTo ?? DEFAULT_FALLBACK_ROUTE);
}

export default function AddVehicleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const partyPortal = usePartyPortalRouteHandlers();
  const { profile } = useAuth();
  const capabilities = useCapabilities();
  const { can: canSurface } = useMemberAccess();
  const { currentOrganization } = useOrganization();
  const returnToParam = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = returnToParam?.startsWith('/') ? returnToParam : undefined;
  const canCreate =
    canAccessVehicles(capabilities) && canSurface("fleet.vehicles.create");

  useEffect(() => {
    if (profile && !canCreate) {
      closeModal(router, returnTo);
    }
  }, [canCreate, profile, returnTo, router]);

  if (profile && !canCreate) {
    return null;
  }

  return (
    <PartyRegistrationPortal
      visible
      initialKind="vehicle"
      onClose={() => closeModal(router, returnTo)}
      organizationId={partyPortal.organizationId}
      noOrganizationMessage={
        currentOrganization ? null : partyPortal.NO_ORG_MESSAGE
      }
      onRefreshOrganization={partyPortal.refreshOrganization}
      onAddClient={partyPortal.handleAddClientComplete}
      onAddSupplier={partyPortal.handleAddSupplierComplete}
      onAddDriver={partyPortal.handleAddDriverDirect}
      onAddVehicle={partyPortal.handleAddVehicleComplete}
    />
  );
}
