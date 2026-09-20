import { ChromeBelowTopNavLoadingScreen } from "@/components/chromeLoadingScreens";
import { ContentErrorState } from "@/components/ContentErrorState";
import { DetailRow, DetailSection } from "@/components/DetailPageLayout";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import { ComplianceDocumentReviewSheet } from "@/features/tripCompliance/components/ComplianceDocumentReviewSheet";
import { CompliancePaymentConfirmModal } from "@/features/tripCompliance/components/CompliancePaymentConfirmModal";
import { ComplianceTripCard } from "@/features/tripCompliance/components/ComplianceTripCard";
import { useComplianceProductEnabled } from "@/features/tripCompliance/hooks/useComplianceProductEnabled";
import {
  useComplianceTripQuery,
  useInvalidateComplianceTrips,
} from "@/features/tripCompliance/hooks/useComplianceTripsQuery";
import { postCompliancePayment, type ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import { COMPLIANCE_STAGE_LABEL, type ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { deriveComplianceQueueReadiness } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { ROUTES } from "@/lib/routes";
import { useMemberAccess } from "@/lib/useMemberAccess";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function ComplianceDetailsScreen({ tripId }: { tripId: string }) {
  const layout = useLayoutInsets();
  const router = useRouter();
  const { can: canSurface, isLoading: accessLoading } = useMemberAccess();
  const { enabled: complianceEnabled, isLoading: productsLoading } = useComplianceProductEnabled();
  const canViewCompliance = complianceEnabled && canSurface("trip_compliance.tab");
  const canViewDocuments = canSurface("trip_compliance.documents.view");
  const canVerifyDocuments = canSurface("trip_compliance.documents.verify");
  const canMarkVerified = canSurface("trip_compliance.trip.mark_verified");
  const canManageFinance = canSurface("trip_compliance.finance.manage");
  const { user } = useAuth();
  const orgCtx = useOptionalOrganization();
  const currentOrganization = orgCtx?.currentOrganization ?? null;
  const { data: summary, isLoading, isError, error, refetch, isFetching } = useComplianceTripQuery(tripId);
  const invalidate = useInvalidateComplianceTrips();
  const [review, setReview] = useState<{
    open: boolean;
    scope: "trip" | "vehicle" | "driver";
  }>({ open: false, scope: "trip" });
  const [pay, setPay] = useState<{ summary: ComplianceTripSummary; category: ComplianceLedgerCategory } | null>(null);
  const [paying, setPaying] = useState(false);
  const contentTopInset = layout.isDesktopWeb ? Layout.desktopTopNavOffset : layout.top;

  if (orgCtx === undefined || accessLoading || productsLoading || (isLoading && !summary)) {
    return <ChromeBelowTopNavLoadingScreen variant="preparing" />;
  }

  if (!canViewCompliance || !summary) {
    return (
      <View style={[styles.screen, { paddingTop: contentTopInset }]}>
        <ContentErrorState
          variant="generic"
          title="Couldn't load Compliance"
          message={!canViewCompliance ? "You don't have access to Compliance." : (error as Error)?.message ?? "Record not found."}
          onRetry={isError ? () => void refetch() : undefined}
        />
      </View>
    );
  }

  const trip = summary.trip;

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: contentTopInset }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: layout.scrollBottomPadding(24),
          paddingHorizontal: Layout.screenPaddingHorizontal,
        },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <ChevronLeft size={16} color={Theme.textMuted} strokeWidth={2.2} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {isFetching ? <Text style={styles.backText}>Updating…</Text> : null}

      <ComplianceTripCard
        summary={summary}
        onReviewDocuments={(scope) => setReview({ open: true, scope })}
        onViewTrip={() => router.push(ROUTES.tripDetail(trip.id) as Parameters<typeof router.push>[0])}
        onPay={() => {
          const readiness = deriveComplianceQueueReadiness(summary);
          if (!readiness.readyCategory) {
            alertMessage("Payment blocked", readiness.blockerLines[0] ?? "This trip is not ready for payment.");
            return;
          }
          setPay({ summary, category: readiness.readyCategory });
        }}
        canManageFinance={canManageFinance}
      />

      <DetailSection title="Trip Information">
        <DetailRow label="Trip ID" value={trip.booking_ref ?? trip.display_trip_id ?? trip.id.slice(0, 8)} />
        <DetailRow label="Client" value={trip.client_name} />
        <DetailRow label="Vehicle" value={trip.vehicle_display_number} />
        <DetailRow label="Driver" value={trip.driver_display_name} />
        <DetailRow label="Trip status" value={trip.status} />
      </DetailSection>

      <DetailSection title="Payment">
        <DetailRow
          label="Advance"
          value={summary.advance ? `₹${summary.advance.amount.toLocaleString("en-IN")}` : "Not processed"}
        />
        <DetailRow
          label="Balance"
          value={summary.balance ? `₹${summary.balance.amount.toLocaleString("en-IN")}` : "Not processed"}
        />
        <DetailRow label="Settlement status" value={COMPLIANCE_STAGE_LABEL[summary.stage]} />
      </DetailSection>

      <DetailSection title="POD">
        <DetailRow label="Hard copy POD" value={summary.hardCopyPod.received ? "Received" : "Pending"} />
        <DetailRow label="Courier" value={summary.hardCopyPod.courier} />
        <DetailRow label="AWB" value={summary.hardCopyPod.awbNumber} />
      </DetailSection>

      <ComplianceDocumentReviewSheet
        visible={review.open}
        onClose={() => setReview({ open: false, scope: "trip" })}
        tripId={trip.id}
        tripLabel={`${trip.booking_ref ?? trip.id.slice(0, 8)} · ${trip.client_name || "Client"}`}
        organizationId={currentOrganization?.id ?? ""}
        actorId={user?.uid ?? null}
        documents={summary.documents}
        canViewDocuments={canViewDocuments}
        canVerify={canVerifyDocuments}
        canMarkVerified={canMarkVerified}
        canManageFinance={canManageFinance}
        summary={summary}
        onChanged={() => {
          invalidate(trip.id);
          void refetch();
        }}
        onPay={() => {
          const readiness = deriveComplianceQueueReadiness(summary);
          if (!readiness.readyCategory) return;
          setPay({ summary, category: readiness.readyCategory });
        }}
        scope={review.scope}
        vehicleId={trip.vehicle_id}
        driverId={trip.driver_id}
        vehicleDocuments={summary.vehicleDocuments ?? []}
        driverDocuments={summary.driverDocuments ?? []}
        vehicleLabel={trip.vehicle_display_number?.trim() || "Unassigned"}
        driverLabel={trip.driver_display_name?.trim() || "Unassigned"}
      />
      <CompliancePaymentConfirmModal
        visible={pay != null}
        summary={pay?.summary ?? null}
        category={pay?.category ?? null}
        submitting={paying}
        onCancel={() => {
          if (!paying) setPay(null);
        }}
        onConfirm={async (values) => {
          if (!pay || !currentOrganization?.id) return;
          setPaying(true);
          const { error: payError } = await postCompliancePayment({
            organizationId: currentOrganization.id,
            trip: pay.summary.trip,
            category: pay.category,
            amount: values.amount,
            paymentModeId: values.paymentModeId,
            paymentModeLabel: values.paymentModeLabel,
            utr: values.utr,
          });
          setPaying(false);
          if (payError) {
            alertMessage("Couldn't post payment", payError.message);
            return;
          }
          setPay(null);
          invalidate(trip.id);
          void refetch();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Theme.compliancePageBg },
  content: { paddingTop: Layout.spacingMedium, gap: Layout.spacingLarge },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: Layout.minTouchTargetSize },
  backText: { fontSize: 13, fontWeight: "600", color: Theme.textMuted },
});
