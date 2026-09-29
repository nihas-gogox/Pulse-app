import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import { SurfaceAccessGate } from "@/components/SurfaceAccessGate";
import { useOrganization } from "@/contexts/OrganizationContext";
import { EditClientModal } from "@/features/clients/components/EditClientModal";
import {
  getClientDetails,
  getLinkedOrgProfile,
  updateClient,
  type ClientRow,
  type UpdateClientData,
} from "@/features/clients/services/clients.service";
import { queryKeys } from "@/lib/queryKeys";
import { ROUTES } from "@/lib/routes";
import { performSafeBack } from "@/lib/useSafeBack";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/** After save/cancel: return to opener (e.g. client detail); fallback if no stack history. */
function closeModal(router: ReturnType<typeof useRouter>) {
  performSafeBack(router, ROUTES.TABS.NETWORK as "/");
}

export default function EditClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClient = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      setClient(null);
      return;
    }
    setLoading(true);
    const { client: row } = await getClientDetails(String(clientId));
    setClient(row ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const handleSave = async (patch: UpdateClientData) => {
    if (!currentOrganization?.id || !client?.id) return;
    const { error } = await updateClient(currentOrganization.id, client.id, patch);
    if (error) throw error;
    await queryClient.refetchQueries({
      queryKey: queryKeys.clients.all(currentOrganization.id),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.invoicing.draftClientsRoot,
    });
    closeModal(router);
  };

  const handleSyncLatest = async () => {
    if (!client?.linked_organization_id) return;
    const { profile, error } = await getLinkedOrgProfile(client.linked_organization_id);
    if (error) throw error;
    if (!profile) return;
    return {
      organizationName: profile.organizationName,
      contactPerson: profile.contactPerson,
      phone: profile.phone,
    };
  };

  if (loading) {
    return <CenteredLoadingView message="Loading client..." />;
  }

  if (!client) {
    return <CenteredLoadingView message="Client not found" />;
  }

  return (
    <SurfaceAccessGate surface="sales.clients.edit">
      <EditClientModal
        visible
        client={client}
        onClose={() => closeModal(router)}
        onSave={handleSave}
        onSyncLatest={client.is_integrated ? handleSyncLatest : undefined}
      />
    </SurfaceAccessGate>
  );
}
