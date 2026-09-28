/**
 * Full-screen customer profile — partner-profile layout (matches supplier CounterpartyProfileSystemCard).
 */
import {
  CounterpartyProfileSystemCard,
  type ProfileContract,
  type ProfileKycDoc,
  type ProfileWarehouse,
} from "@/components/CounterpartyProfileSystemCard";
import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import { ContentErrorState } from "@/components/ContentErrorState";
import Theme from "@/constants/Theme";
import { ClientInvoicePodPolicySection } from "@/features/clients/components/ClientInvoicePodPolicySection";
import { useClientManagementBundleQuery } from "@/features/clients/hooks/useClientManagementBundle";
import type { ClientManagementBundle } from "@/features/clients/types/clientManagement.types";
import { KYC_DOC_LABELS } from "@/features/clients/types/clientManagement.types";
import type { ClientRow } from "@/features/clients/services/clients.service";
import { computeKycScore } from "@/features/clients/utils/clientManagement.util";
import { formatCityStateLabel } from "@/lib/placeCityState.util";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatINR } from "@/lib/format";
import { useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  clientId: string;
  initialTab?: string;
  onBack: () => void;
};

function mapWarehouses(bundle: ClientManagementBundle): ProfileWarehouse[] {
  return bundle.warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    address: [w.address, w.city, w.state, w.pincode].filter(Boolean).join(", ") || "—",
    gstNumber: w.local_gstin,
    contactPerson: w.contact_name,
    phone: w.contact_phone,
  }));
}

function mapContracts(bundle: ClientManagementBundle): ProfileContract[] {
  const warehouseById = new Map(
    bundle.warehouses.map((w) => [w.id, w.name] as const),
  );
  return bundle.lane_rates.map((lane) => {
    const price =
      lane.rate ??
      lane.base_rate ??
      lane.per_mt_rate ??
      0;
    const perTon =
      lane.rate_type === "per_ton" ||
      lane.rate_type === "per_kg" ||
      lane.pricing_model === "per_ton" ||
      lane.pricing_model === "per_mt_km";
    const warehouseId = lane.origin_warehouse_id ?? null;
    const warehouseName = warehouseId
      ? warehouseById.get(warehouseId) ?? null
      : null;
    return {
      id: lane.id,
      pickup: formatCityStateLabel(lane.origin_label) || lane.origin_label,
      destination:
        formatCityStateLabel(lane.destination_label) || lane.destination_label,
      price: Number(price) || 0,
      pricingType: perTon ? "per_ton" : "per_trip",
      vehicleType: lane.vehicle_type,
      warehouseId,
      warehouseName,
    };
  });
}

function mapKycDocs(bundle: ClientManagementBundle): ProfileKycDoc[] {
  return bundle.kyc_documents.map((doc) => ({
    id: doc.id,
    documentType: doc.doc_label?.trim() || KYC_DOC_LABELS[doc.doc_type] || doc.doc_type,
    status: doc.status === "verified" ? "Verified" : "Pending",
    dateLabel: doc.verified_at ?? doc.updated_at ?? doc.created_at,
  }));
}

function projectedVolumeLabel(client: ClientRow): string {
  const raw = (client as { projected_contract_revenue?: number | null })
    .projected_contract_revenue;
  if (raw == null || !Number.isFinite(Number(raw))) return "—";
  return formatINR(Number(raw));
}

export function ClientProfileScreen({ clientId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const bundleQ = useClientManagementBundleQuery(orgId, clientId);

  const bundle = bundleQ.data;
  const client = bundle?.client as ClientRow | null | undefined;

  const warehouses = useMemo(
    () => (bundle ? mapWarehouses(bundle) : []),
    [bundle],
  );
  const contracts = useMemo(
    () => (bundle ? mapContracts(bundle) : []),
    [bundle],
  );
  const kycDocs = useMemo(
    () => (bundle ? mapKycDocs(bundle) : []),
    [bundle],
  );
  const networkTrustLabel = useMemo(() => {
    if (!bundle) return "—";
    const { score } = computeKycScore(bundle.kyc_documents);
    return `${score}%`;
  }, [bundle]);

  if (!orgId || bundleQ.isLoading) {
    return <CenteredLoadingView />;
  }

  if (bundleQ.error || !bundle || !client) {
    return (
      <ContentErrorState
        variant="generic"
        message={bundleQ.error?.message ?? "Client not found"}
        onRetry={() => {
          void bundleQ.refetch();
        }}
      />
    );
  }

  const isIntegrated =
    client.is_integrated ?? Boolean(client.linked_organization_id);
  const displayName = client.name?.trim() || client.contact_person?.trim() || "Customer";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Theme.screenBackground,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <CounterpartyProfileSystemCard
          visible
          presentation="page"
          profileTitle="Customer Profile"
          headerSlot={
            <ClientInvoicePodPolicySection
              orgId={orgId}
              clientId={clientId}
              rawPolicy={bundle.client?.invoice_pod_policy}
              compact
            />
          }
          type="client"
          organizationName={displayName}
          adminName={client.contact_person}
          email={client.email}
          phone={client.phone}
          gstNumber={client.gstin}
          panNumber={client.pan_number}
          billingAddress={client.address}
          validFrom={client.valid_from}
          validTo={client.valid_to}
          gridVolumeLabel={projectedVolumeLabel(client)}
          networkTrustLabel={networkTrustLabel}
          isIntegrated={isIntegrated}
          entityDisplayId={client.display_id ?? client.id?.slice(0, 8) ?? null}
          warehouses={warehouses}
          contracts={contracts}
          kycDocs={kycDocs}
          organizationId={orgId}
          clientId={clientId}
          editableWarehouses={bundle.warehouses}
          editableLaneRates={bundle.lane_rates}
          onProfileEntitiesChange={() => {
            void bundleQ.refetch();
          }}
          onClose={onBack}
          onEditPress={() => {}}
        />
      </View>
    </View>
  );
}
