import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import { useOrganization } from "@/contexts/OrganizationContext";
import type { ConnectionInviteeMatch } from "@/features/clients/components/AddClientModal";
import { PartyRegistrationPortal } from "@/features/finance/components/PartyRegistrationPortal";
import { usePartyPortalRouteHandlers } from "@/features/finance/hooks/usePartyPortalRouteHandlers";
import { ROUTES } from "@/lib/routes";
import { performSafeBack } from "@/lib/useSafeBack";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getConnectionInviteeByPhone,
  createConnectionRequest,
} from "@/features/connections/services/connectionRequests.service";

function closeModal(
  router: ReturnType<typeof useRouter>,
  returnTo?: string,
) {
  performSafeBack(router, returnTo ?? (ROUTES.TABS.NETWORK as "/"));
}

export default function AddClientScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const partyPortal = usePartyPortalRouteHandlers();
  const { currentOrganization, isLoading } = useOrganization();
  const returnToParam = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = returnToParam?.startsWith("/") ? returnToParam : undefined;

  const searchInviteeByPhone = async (
    phone: string,
  ): Promise<ConnectionInviteeMatch | null> => {
    const { error, invitee } = await getConnectionInviteeByPhone(
      phone,
      currentOrganization?.id ?? "",
    );
    if (error || !invitee) return null;
    return {
      organization_id: invitee.organization_id,
      full_name: invitee.full_name,
      phone: invitee.phone,
      organization_name: invitee.organization_name,
      profile_company_name: invitee.profile_company_name,
      profile_role: invitee.profile_role,
    };
  };

  const handleSendInvitation = async (toOrgId: string) => {
    if (!currentOrganization?.id) {
      throw new Error(partyPortal.NO_ORG_MESSAGE);
    }
    const { error } = await createConnectionRequest(
      currentOrganization.id,
      toOrgId,
      { requestShipperClient: true, requestCarrierSupplier: false },
    );
    if (error) throw error;
  };

  if (isLoading) {
    return <CenteredLoadingView message="Loading organization…" />;
  }

  return (
    <PartyRegistrationPortal
      visible
      initialKind="client"
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
      searchInviteeByPhone={searchInviteeByPhone}
      onSendInvitation={handleSendInvitation}
    />
  );
}
