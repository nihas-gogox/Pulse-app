import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalLanguage } from "@/contexts/LanguageContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PartyRegistrationPortal } from "@/features/finance/components/PartyRegistrationPortal";
import { usePartyPortalRouteHandlers } from "@/features/finance/hooks/usePartyPortalRouteHandlers";
import type { SupplierInviteeMatch } from "@/features/suppliers/components/AddSupplierModal";
import {
  getConnectionInviteeByPhone,
  createConnectionRequest,
} from "@/features/connections/services/connectionRequests.service";
import { SurfaceAccessGate } from "@/components/SurfaceAccessGate";
import { canAccessSuppliers } from "@/lib/capabilities";
import { useCapabilities } from "@/lib/useCapabilities";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { ROUTES } from "@/lib/routes";
import { performSafeBack } from "@/lib/useSafeBack";

export default function AddSupplierScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const partyPortal = usePartyPortalRouteHandlers();
  const { profile } = useAuth();
  const { t } = useOptionalLanguage();
  const capabilities = useCapabilities();
  const { isLoading: accessLoading } = useMemberAccess();
  const { currentOrganization } = useOrganization();
  const returnToParam = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = returnToParam?.startsWith("/") ? returnToParam : undefined;

  // Operating-model capability check only. The per-member surface grant
  // (sales.suppliers.create) is enforced by SurfaceAccessGate below, which also
  // holds a frame until surfaces hydrate.
  const orgAllowsSuppliers = canAccessSuppliers(capabilities);

  // Deliberately NO redirect-on-denied effect here. The previous version bounced
  // via router.back() inside a useEffect keyed on `profile && !canCreate`, but
  // useMemberAccess returns an empty surface map until the workspace resolves —
  // so canSurface was false for EVERYTHING in that window while `profile` was
  // already set from auth. Legitimately-permitted dispatchers were ejected
  // before their grants ever arrived, and because this screen is reachable
  // mid-trip-creation, the forced navigation also destroyed the in-progress
  // form. Render a denial notice instead of navigating.
  if (accessLoading) {
    // Inert frame while access resolves — matches SurfaceAccessGate.
    return <View style={{ flex: 1 }} />;
  }

  if (profile && !orgAllowsSuppliers) {
    return (
      <View style={styles.noticeWrap}>
        <Text style={styles.noticeTitle}>{t("surfaceNoAccessTitle")}</Text>
        <Text style={styles.noticeBody}>{t("surfaceNoAccessBody")}</Text>
      </View>
    );
  }

  const closeModal = () => {
    performSafeBack(router, returnTo ?? (ROUTES.TABS.NETWORK as "/"));
  };

  const searchInviteeByPhone = async (
    phone: string,
  ): Promise<SupplierInviteeMatch | null> => {
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

  const handleSendSupplierInvitation = async (toOrgId: string) => {
    if (!currentOrganization?.id) return;
    const { error } = await createConnectionRequest(
      currentOrganization.id,
      toOrgId,
      { requestShipperClient: false, requestCarrierSupplier: true },
    );
    if (error) throw error;
  };

  return (
    <SurfaceAccessGate surface="sales.suppliers.create">
      <PartyRegistrationPortal
        visible
        initialKind="supplier"
        onClose={closeModal}
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
        onSendSupplierInvitation={handleSendSupplierInvitation}
      />
    </SurfaceAccessGate>
  );
}

const styles = StyleSheet.create({
  noticeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.screenPaddingHorizontal,
    backgroundColor: Theme.screenBackground,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.textPrimary,
    textAlign: "center",
    marginBottom: Layout.spacingSmall,
  },
  noticeBody: {
    fontSize: 14,
    color: Theme.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
});
