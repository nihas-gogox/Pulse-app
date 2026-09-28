import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Theme from '@/constants/Theme';
import Layout from '@/constants/Layout';
import { ROUTES } from '@/lib/routes';
import { useInvoicingExecuteTripsQuery } from '@/lib/queries/useInvoicingExecuteQueries';
import { useActiveWorkspace } from '@/contexts/ActiveWorkspaceContext';
import type { AdditionalCharge, InvoiceConfig, InvoicingTripView } from '@/features/invoicing/services/invoicing.service';
import { getInvoiceBrandingSettings } from '@/features/invoicing/services/invoiceBranding.service';
import {
  resolveInvoiceIssuerIdentity,
  type InvoiceIssuerIdentity,
} from '@/features/invoicing/services/invoiceIssuerIdentity.service';
import { CenteredLoadingView } from '@/components/CenteredLoadingView';
import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/lib/useCapabilities';
import { useMemberAccess } from '@/lib/useMemberAccess';
import InvoicePdf from '@/components/InvoicePdf';
import { useInvoiceDraftClientsQuery } from '@/features/invoicing/hooks/useInvoiceDraftClients';
import { mergeInvoiceChargesWithTripCnDn } from '@/features/invoicing/services/invoiceCnDn.service';
import {
  buildInvoiceDraftModel,
  formatInvoicePreviewDate,
  mapInvoiceDraftModelToPdfData,
  uniqueTripClientIds,
  uniqueTripClientNames,
} from '@/features/invoicing/services/invoicePreviewModel.service';
import { fetchInvoiceSettlementFacts } from '@/features/invoicing/services/invoiceSettlementFacts.service';
import {
  useTripFinanceAdjustmentsMap,
} from '@/lib/queries/useTripFinanceAdjustmentsQuery';

interface InvoicePreviewParams extends Record<string, string | undefined> {
  activeClient: string;
  selectedTripIds: string;
  paymentTerms: string;
  notes: string;
  includeGst: string;
  gstRate: string;
  includeFuel: string;
  fuelRate: string;
  additionalCharges: string;
  previewDate: string;
  showSplit?: string;
}

function canAccessInvoicing(
  profile: ReturnType<typeof useAuth>['profile'],
  caps: import('@/lib/capabilities').Capability[],
): boolean {
  if (!profile || profile.role === 'driver') return false;
  return (
    caps.includes('finance_view') ||
    caps.includes('finance_manage') ||
    caps.includes('dispatch') ||
    caps.includes('dispatch_for_own_fleet')
  );
}

function safeJsonArray<T>(value: unknown): T[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function InvoicePdfPreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams() as InvoicePreviewParams;
  const { profile } = useAuth();
  const caps = useCapabilities();
  const { can: canSurface } = useMemberAccess();
  const { activeWorkspace } = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  const [brandingOverlay, setBrandingOverlay] = useState<{
    companyName: string | null;
    logoUrl: string | null;
  }>({ companyName: null, logoUrl: null });
  const [bankDetailsLines, setBankDetailsLines] = useState<string[]>([]);
  const [msmeNumber, setMsmeNumber] = useState<string | null>(null);

  const activeClient = params.activeClient || '';
  const paymentTerms = params.paymentTerms || '';
  const notes = params.notes || '';
  const previewDate = params.previewDate
    ? formatInvoicePreviewDate(params.previewDate)
    : formatInvoicePreviewDate(new Date());

  const parsedIncludeGst = params.includeGst === 'true';
  const parsedGstRate = Number.parseFloat(params.gstRate || '0') || 0;
  const parsedIncludeFuel = params.includeFuel === 'true';
  const parsedFuelRate = Number.parseFloat(params.fuelRate || '0') || 0;
  const parsedAdditionalCharges = safeJsonArray<AdditionalCharge>(params.additionalCharges);
  const parsedSelectedTripIds = safeJsonArray<string>(params.selectedTripIds);

  const { data: allTrips = [], isLoading: isLoadingTrips, isError: isErrorTrips, error: errorTrips } =
    useInvoicingExecuteTripsQuery(workspaceId);

  const tripsById = useMemo(() => {
    const map = new Map<string, InvoicingTripView>();
    for (const t of allTrips) {
      map.set(t.internal_id, t);
      map.set(t.id, t);
    }
    return map;
  }, [allTrips]);

  const selectedTrips: InvoicingTripView[] = useMemo(
    () => parsedSelectedTripIds.map((id) => tripsById.get(id)).filter(Boolean) as InvoicingTripView[],
    [parsedSelectedTripIds, tripsById],
  );

  const clientIds = useMemo(() => uniqueTripClientIds(selectedTrips), [selectedTrips]);
  const clientNames = useMemo(() => uniqueTripClientNames(selectedTrips), [selectedTrips]);
  const { data: fetchedClients = [] } = useInvoiceDraftClientsQuery(
    workspaceId,
    clientIds,
    clientNames,
  );

  const { record: tripAdjustmentsRecord } = useTripFinanceAdjustmentsMap(
    workspaceId,
    selectedTrips.map((t) => t.internal_id).filter(Boolean),
  );

  const invoiceConfig: InvoiceConfig = useMemo(
    () => ({
      includeGst: parsedIncludeGst,
      gstRate: parsedGstRate,
      includeFuel: parsedIncludeFuel,
      fuelRate: parsedFuelRate,
      additionalCharges: mergeInvoiceChargesWithTripCnDn(
        parsedAdditionalCharges,
        selectedTrips,
        tripAdjustmentsRecord,
      ),
    }),
    [
      parsedAdditionalCharges,
      parsedFuelRate,
      parsedGstRate,
      parsedIncludeFuel,
      parsedIncludeGst,
      selectedTrips,
      tripAdjustmentsRecord,
    ],
  );

  const allowed =
    canAccessInvoicing(profile, caps) && canSurface('finance.invoicing');

  const issuer: InvoiceIssuerIdentity | null = useMemo(
    () =>
      resolveInvoiceIssuerIdentity({
        workspace: activeWorkspace,
        branding: brandingOverlay,
      }),
    [activeWorkspace, brandingOverlay],
  );

  useEffect(() => {
    let mounted = true;
    if (!workspaceId) {
      setBrandingOverlay({ companyName: null, logoUrl: null });
      setBankDetailsLines([]);
      setMsmeNumber(null);
      return;
    }
    (async () => {
      const [{ settings }, settlement] = await Promise.all([
        getInvoiceBrandingSettings(workspaceId),
        fetchInvoiceSettlementFacts({
          organizationId: workspaceId,
          accountName: activeWorkspace?.name ?? null,
        }),
      ]);
      if (!mounted) return;
      setBrandingOverlay(settings);
      setBankDetailsLines(settlement.facts.bankDetailsLines);
      setMsmeNumber(settlement.facts.msmeNumber);
    })();
    return () => {
      mounted = false;
    };
  }, [activeWorkspace?.name, workspaceId]);

  const draftModel = useMemo(() => {
    if (!issuer || selectedTrips.length === 0) return null;
    return buildInvoiceDraftModel({
      issuer,
      trips: selectedTrips,
      config: invoiceConfig,
      previewDate,
      paymentTerms: paymentTerms || null,
      notes: notes || null,
      fetchedClients,
      displayNameFallback: activeClient || null,
    });
  }, [activeClient, fetchedClients, invoiceConfig, issuer, notes, paymentTerms, previewDate, selectedTrips]);

  const invoiceData = useMemo(
    () =>
      draftModel
        ? mapInvoiceDraftModelToPdfData(draftModel, { bankDetailsLines, msmeNumber })
        : null,
    [bankDetailsLines, draftModel, msmeNumber],
  );

  if (!allowed) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
        <Text style={styles.blockedTitle}>Not available</Text>
        <Text style={styles.blockedBody}>Your account does not have access to execute invoices.</Text>
        <Pressable style={styles.blockedBtn} onPress={() => router.back()}>
          <Text style={styles.blockedBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!workspaceId || isLoadingTrips) {
    return (
      <CenteredLoadingView
        message={!workspaceId ? 'Loading workspace...' : 'Loading trips...'}
      />
    );
  }

  if (isErrorTrips) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.blockedTitle}>Could not load trips</Text>
        <Text style={styles.blockedBody}>{errorTrips instanceof Error ? errorTrips.message : 'Unknown error'}</Text>
        <Pressable style={styles.blockedBtn} onPress={() => router.back()}>
          <Text style={styles.blockedBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (selectedTrips.length === 0 || !invoiceData) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
        <Text style={styles.blockedTitle}>No trips selected</Text>
        <Text style={styles.blockedBody}>Please select at least one approved trip to generate an invoice preview.</Text>
        <Pressable style={styles.blockedBtn} onPress={() => router.back()}>
          <Text style={styles.blockedBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(ROUTES.INVOICING_EXECUTE_CREATE as never);
  };

  return (
    <View style={[styles.studio, { paddingTop: insets.top }]}>
      <View style={styles.previewChrome}>
        <Pressable
          onPress={handleBack}
          style={styles.previewBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to invoice draft"
          hitSlop={Layout.touchTargetHitSlop}
        >
          <Text style={styles.previewBackText}>← Back to draft</Text>
        </Pressable>
      </View>
      <View style={styles.previewBody}>
        <InvoicePdf
          invoiceData={invoiceData}
          initialShowSplit={params.showSplit !== 'false'}
          onBack={handleBack}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    justifyContent: 'center',
    backgroundColor: Theme.screenBackground,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.textPrimaryDark,
    marginBottom: 8,
  },
  blockedBody: {
    fontSize: 14,
    color: Theme.textSecondary,
    marginBottom: 20,
  },
  blockedBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  blockedBtnText: {
    color: Theme.buttonPrimaryText,
    fontWeight: '700',
  },
  studio: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.analyticsCanvas,
  },
  previewChrome: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingVertical: 8,
    backgroundColor: Theme.screenBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderMedium,
    zIndex: 20,
  },
  previewBackBtn: {
    minHeight: Layout.minTouchTargetSize,
    justifyContent: 'center',
    paddingRight: 12,
  },
  previewBackText: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.accentBrownDeep,
  },
  previewBody: {
    flex: 1,
    minHeight: 0,
  },
});
