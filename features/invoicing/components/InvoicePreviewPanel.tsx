import { LoadingIndicator } from "@/components/LoadingIndicator";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useTabBarAwareScrollProps } from "@/contexts/DemoTabBarScrollContext";
import { InvoiceTripCnDnGroup } from "@/features/invoicing/components/InvoiceTripCnDnGroup";
import { useInvoiceDraftClientsQuery } from "@/features/invoicing/hooks/useInvoiceDraftClients";
import {
  invoiceOnlyCharges,
  invoiceTripAdjustedAmount,
  mergeInvoiceChargesWithTripCnDn,
} from "@/features/invoicing/services/invoiceCnDn.service";
import type {
  AdditionalCharge,
  InvoicePayload,
  InvoicingTripView,
} from "@/features/invoicing/services/invoicing.service";
import type { InvoiceIssuerIdentity } from "@/features/invoicing/services/invoiceIssuerIdentity.service";
import {
  buildInvoiceDraftModel,
  displayInvoicePreviewDate,
  formatInvoicePreviewDate,
  invoiceDraftTaxDisplay,
  uniqueTripClientIds,
  uniqueTripClientNames,
  type InvoiceDraftModel,
} from "@/features/invoicing/services/invoicePreviewModel.service";
import {
  invoicePreviewCanSaveDraft,
  resolveInvoicePreviewItemSource,
} from "@/features/invoicing/utils/financeInvoicePreview.util";
import { ProvisionAdjustmentModal } from "@/features/trips/components/trip-detail/adjustment/ProvisionAdjustmentModal";
import {
  addTripAdjustment,
  updateTripAdjustment,
  type TripAdjustment,
} from "@/features/trips/services/tripAdjustments";
import {
  adjustmentsForTripId,
  useInvalidateTripFinanceAdjustments,
  useTripFinanceAdjustmentsMap,
} from "@/lib/queries/useTripFinanceAdjustmentsQuery";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface InvoicePreviewPanelProps {
  onClose?: () => void;
  onPreview: (params: Record<string, string>) => void; // Changed from onFinalize to onPreview
  /** Parent execute screen owns persist. Preview route stays mutation-free. */
  onIssue?: (args: { internalIds: string[]; payload: InvoicePayload }) => void;
  isFinalizing: boolean; // This will now represent the state of PDF generation/navigation
  isIssuing?: boolean;
  activeClient: string | null;
  selectedTrips: InvoicingTripView[];
  isStandalone?: boolean;
  issuer: InvoiceIssuerIdentity | null;
  workspaceOrgId?: string | null;
  previewExpanded?: boolean;
  onToggleExpand?: () => void;
  onEditClient?: (clientId: string) => void;
  /** UI gate only — does not change executeInvoiceCreation. */
  invoiceBuildBlockedReason?: string | null;
  /** UI gate only — Issue still revalidates policy in executeInvoiceCreation. */
  invoiceIssueBlockedReason?: string | null;
  density?: "default" | "compact";
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  readOnly?: boolean;
  /** Canonical draft from Manual Invoice — same InvoiceDraftModel as trip preview. */
  externalDraft?: InvoiceDraftModel | null;
  onIssueExternal?: () => void;
}

const PAYMENT_TERMS_OPTIONS = [
  "Due on Receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
];

export function InvoicePreviewPanel({
  onClose,
  onPreview, // Changed from onFinalize
  onIssue,
  isFinalizing,
  isIssuing = false,
  activeClient,
  selectedTrips,
  isStandalone = false,
  issuer,
  workspaceOrgId = null,
  previewExpanded = false,
  onToggleExpand,
  onEditClient,
  invoiceBuildBlockedReason = null,
  invoiceIssueBlockedReason = null,
  density = "default",
  onSaveDraft,
  saveDraftLabel = "Save as Draft",
  readOnly = false,
  externalDraft = null,
  onIssueExternal,
}: InvoicePreviewPanelProps) {
  const insets = useSafeAreaInsets();
  const layout = useLayoutInsets();
  const tabBarScrollProps = useTabBarAwareScrollProps();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAnchor, setTermsAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const termsTriggerRef = useRef<View>(null);
  const [notes, setNotes] = useState("");

  const closeTermsMenu = useCallback(() => {
    setShowTermsModal(false);
    setTermsAnchor(null);
  }, []);

  const toggleTermsMenu = useCallback(() => {
    if (showTermsModal) {
      closeTermsMenu();
      return;
    }
    const node = termsTriggerRef.current;
    if (!node?.measureInWindow) {
      setShowTermsModal(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setTermsAnchor({ x, y, width, height });
      setShowTermsModal(true);
    });
  }, [closeTermsMenu, showTermsModal]);

  const selectPaymentTerm = useCallback(
    (term: string) => {
      setPaymentTerms(term);
      closeTermsMenu();
    },
    [closeTermsMenu],
  );

  const [includeGst, setIncludeGst] = useState(false);
  const [gstRate, setGstRate] = useState(5);
  const [includeFuel, setIncludeFuel] = useState(false);
  const [fuelRate, setFuelRate] = useState(2.5);
  const [additionalCharges, setAdditionalCharges] = useState<
    AdditionalCharge[]
  >([]);
  const [previewDate] = useState(() => formatInvoicePreviewDate(new Date()));
  const [cnDnTrip, setCnDnTrip] = useState<InvoicingTripView | null>(null);
  const [cnDnEdit, setCnDnEdit] = useState<TripAdjustment | null>(null);
  const [showSplit, setShowSplit] = useState(true);
  /** Draft-only freight overrides — does not write back to trip records. */
  const [tripAmountOverrides, setTripAmountOverrides] = useState<
    Record<string, number>
  >({});
  const [tripAmountDraftText, setTripAmountDraftText] = useState<
    Record<string, string>
  >({});

  const selectedTripInternalIds = useMemo(
    () => selectedTrips.map((t) => t.internal_id).filter(Boolean),
    [selectedTrips],
  );

  useEffect(() => {
    const allowed = new Set(
      selectedTrips.map((t) => t.internal_id || t.id).filter(Boolean),
    );
    setTripAmountOverrides((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key)) next[key] = value;
        else changed = true;
      }
      return changed ? next : prev;
    });
    setTripAmountDraftText((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key)) next[key] = value;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedTrips]);

  const billingTrips = useMemo(
    () =>
      selectedTrips.map((trip) => {
        const key = trip.internal_id || trip.id;
        const override = tripAmountOverrides[key];
        if (override == null || !Number.isFinite(override)) return trip;
        return { ...trip, amount: Math.max(0, override) };
      }),
    [selectedTrips, tripAmountOverrides],
  );

  const { record: tripAdjustmentsRecord } = useTripFinanceAdjustmentsMap(
    workspaceOrgId,
    selectedTripInternalIds,
  );
  const invalidateTripAdjustments = useInvalidateTripFinanceAdjustments();

  const clientIds = useMemo(
    () => uniqueTripClientIds(selectedTrips),
    [selectedTrips],
  );
  const clientNames = useMemo(
    () => uniqueTripClientNames(selectedTrips),
    [selectedTrips],
  );
  const { data: fetchedClients = [] } = useInvoiceDraftClientsQuery(
    workspaceOrgId,
    clientIds,
    clientNames,
  );

  const invoiceConfig = useMemo(
    () => ({
      includeGst,
      gstRate,
      includeFuel,
      fuelRate,
      additionalCharges: mergeInvoiceChargesWithTripCnDn(
        additionalCharges,
        billingTrips,
        tripAdjustmentsRecord,
      ),
    }),
    [
      additionalCharges,
      billingTrips,
      fuelRate,
      gstRate,
      includeFuel,
      includeGst,
      tripAdjustmentsRecord,
    ],
  );

  const draft = useMemo(() => {
    if (externalDraft) return externalDraft;
    if (!issuer || billingTrips.length === 0) return null;
    return buildInvoiceDraftModel({
      issuer,
      trips: billingTrips,
      config: invoiceConfig,
      previewDate,
      paymentTerms,
      notes,
      fetchedClients,
      displayNameFallback: activeClient,
    });
  }, [
    activeClient,
    billingTrips,
    fetchedClients,
    invoiceConfig,
    issuer,
    notes,
    paymentTerms,
    previewDate,
    externalDraft,
  ]);

  const taxDisplay = draft ? invoiceDraftTaxDisplay(draft.tax) : null;
  const canSaveDraft = invoicePreviewCanSaveDraft({
    hasExternalDraft: Boolean(externalDraft),
    selectedTripCount: selectedTrips.length,
  });
  const previewLines = draft?.lines ?? [];
  const invoiceNumberLabel = draft?.invoice_number_label ?? "DRAFT";
  const previewItemSource = resolveInvoicePreviewItemSource({
    selectedTripCount: selectedTrips.length,
    draftLineCount: previewLines.length,
  });

  const handleUpdateTripAmount = useCallback(
    (tripKey: string, raw: string) => {
      setTripAmountDraftText((prev) => ({ ...prev, [tripKey]: raw }));
      const cleaned = raw.replace(/,/g, "").trim();
      if (cleaned === "" || cleaned === ".") {
        setTripAmountOverrides((prev) => ({ ...prev, [tripKey]: 0 }));
        return;
      }
      const parsed = Number.parseFloat(cleaned);
      if (!Number.isFinite(parsed)) return;
      setTripAmountOverrides((prev) => ({
        ...prev,
        [tripKey]: Math.max(0, parsed),
      }));
    },
    [],
  );

  const handleBlurTripAmount = useCallback(
    (tripKey: string, fallbackAmount: number) => {
      setTripAmountDraftText((prev) => {
        if (!(tripKey in prev)) return prev;
        const next = { ...prev };
        delete next[tripKey];
        return next;
      });
      setTripAmountOverrides((prev) => {
        const current = prev[tripKey];
        if (current == null) return prev;
        if (!Number.isFinite(current)) {
          const next = { ...prev };
          delete next[tripKey];
          return next;
        }
        // Clear override when it matches the original trip amount.
        if (Math.abs(current - fallbackAmount) < 0.005) {
          const next = { ...prev };
          delete next[tripKey];
          return next;
        }
        return { ...prev, [tripKey]: Math.max(0, current) };
      });
    },
    [],
  );

  const handleAddCharge = useCallback((tripId?: string) => {
    setAdditionalCharges((prev) => {
      if (!tripId) {
        const hasEmptyGlobal = prev.some(
          (c) => !c.tripId && c.description.trim() === "" && Math.abs(c.amount) === 0,
        );
        if (hasEmptyGlobal) return prev;
      }
      return [
        ...prev,
        { id: Date.now().toString(), description: "", amount: 0, tripId },
      ];
    });
  }, []);

  const handleUpdateCharge = useCallback(
    (id: string, field: "description" | "amount", value: string | number) => {
      setAdditionalCharges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
      );
    },
    [],
  );

  const handleRemoveCharge = useCallback((id: string) => {
    setAdditionalCharges((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const cnDnBillingAmount = useMemo(() => {
    if (!cnDnTrip) return 0;
    const key = cnDnTrip.internal_id || cnDnTrip.id;
    const billed = billingTrips.find((t) => (t.internal_id || t.id) === key);
    return billed?.amount ?? cnDnTrip.amount ?? 0;
  }, [billingTrips, cnDnTrip]);

  const closeCnDnModal = useCallback(() => {
    setCnDnTrip(null);
    setCnDnEdit(null);
  }, []);

  const handleSaveTripCnDn = useCallback(
    async (params: {
      type: "revenue" | "cost";
      impact: "plus" | "minus";
      amount: number;
      reason: string;
    }) => {
      const tripId = cnDnTrip?.internal_id?.trim();
      const orgId = workspaceOrgId?.trim();
      if (!tripId || !orgId) {
        Alert.alert(
          "Credit / debit note",
          "This trip is not linked, so the note cannot be saved to finance.",
        );
        return;
      }
      await addTripAdjustment(
        tripId,
        {
          type: "revenue",
          impact: params.impact,
          amount: params.amount,
          reason: params.reason,
        },
        { organizationId: orgId, missionKey: cnDnTrip?.id ?? null },
      );
      await invalidateTripAdjustments();
    },
    [cnDnTrip, invalidateTripAdjustments, workspaceOrgId],
  );

  const handleUpdateTripCnDn = useCallback(
    async (
      adjustmentId: string,
      params: {
        type: "revenue" | "cost";
        impact: "plus" | "minus";
        amount: number;
        reason: string;
      },
    ) => {
      const tripId = cnDnTrip?.internal_id?.trim();
      if (!tripId) return;
      await updateTripAdjustment(tripId, adjustmentId, {
        type: "revenue",
        impact: params.impact,
        amount: params.amount,
        reason: params.reason,
      });
      await invalidateTripAdjustments();
    },
    [cnDnTrip, invalidateTripAdjustments],
  );

  const formatCurrency = (val: number) => {
    return (
      "₹" +
      val.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleInitiatePreview = async () => {
    if (invoiceBuildBlockedReason) return;
    if (selectedTrips.length === 0) return;

    const params = {
      activeClient: activeClient || "",
      selectedTripIds: JSON.stringify(
        selectedTrips.map((t) => t.internal_id || t.id),
      ),
      paymentTerms,
      notes,
      includeGst: includeGst.toString(),
      gstRate: gstRate.toString(),
      includeFuel: includeFuel.toString(),
      fuelRate: fuelRate.toString(),
      additionalCharges: JSON.stringify(invoiceOnlyCharges(additionalCharges)),
      previewDate,
      showSplit: showSplit ? "true" : "false",
    };
    onPreview(params);
  };

  const issueBlocked =
    !onIssue ||
    isIssuing ||
    isFinalizing ||
    (!externalDraft && selectedTrips.length === 0) ||
    Boolean(invoiceBuildBlockedReason) ||
    Boolean(invoiceIssueBlockedReason) ||
    !draft ||
    draft.tax.status === "blocked";

  const handleIssueInvoice = () => {
    if (issueBlocked || !draft) return;
    if (externalDraft && onIssueExternal) {
      onIssueExternal();
      return;
    }
    if (!onIssue) return;
    const internalIds = selectedTrips
      .map((t) => t.internal_id || t.id)
      .filter((id) => Boolean(id));
    if (internalIds.length === 0) return;
    onIssue({
      internalIds,
      payload: {
        notes,
        paymentTerms,
        includeGst,
        gstRate,
        includeFuel,
        fuelRate,
        additionalCharges: invoiceOnlyCharges(additionalCharges),
        clientName: activeClient ?? undefined,
        calculations: {
          subtotal: draft.tax.taxable_base,
          sgst: draft.tax.sgst_amount,
          cgst: draft.tax.cgst_amount,
          igst: draft.tax.igst_amount,
          totalAmount: draft.tax.total_amount,
        },
      },
    });
  };

  const globalCharges = additionalCharges.filter((c) => !c.tripId);
  const primaryTrip = selectedTrips[0] ?? null;
  const shipment = draft?.shipment;
  const pickupLabel =
    (selectedTrips.length === 1 ? shipment?.pickup : null) ||
    primaryTrip?.pickup ||
    (primaryTrip?.route
      ? primaryTrip.route
          .split(/\s*(?:->|→|➔|⇒)\s*/)
          .map((p) => p.trim())
          .filter(Boolean)[0]
      : null) ||
    "—";
  const deliveryLabel =
    (selectedTrips.length === 1 ? shipment?.delivery : null) ||
    primaryTrip?.delivery ||
    (primaryTrip?.route
      ? primaryTrip.route
          .split(/\s*(?:->|→|➔|⇒)\s*/)
          .map((p) => p.trim())
          .filter(Boolean)[1]
      : null) ||
    "—";
  const truckNoLabel =
    (selectedTrips.length === 1
      ? shipment?.truck_no || primaryTrip?.vehicle_number
      : null) || "—";
  const loadTypeLabel =
    (selectedTrips.length === 1
      ? shipment?.load_type || primaryTrip?.load_type
      : null) || "—";
  const lrNumberLabel =
    (selectedTrips.length === 1
      ? shipment?.lr_number || primaryTrip?.lr_number
      : null) || "—";
  const customerLabel =
    draft?.client.legal_name ||
    draft?.client.display_name ||
    activeClient ||
    "Select a customer…";
  const dueDateLabel = draft?.indicative_due_date
    ? displayInvoicePreviewDate(draft.indicative_due_date)
    : "—";
  const invoiceDateLabel = displayInvoicePreviewDate(previewDate);

  const termsMenuWidth = Math.max(termsAnchor?.width ?? 160, 160);
  const termsMenuEstimatedHeight =
    PAYMENT_TERMS_OPTIONS.length * Layout.minTouchTargetSize + 12;
  const termsMenuStyle = useMemo(() => {
    if (!termsAnchor) return null;
    const gap = 4;
    const openBelow =
      termsAnchor.y + termsAnchor.height + gap + termsMenuEstimatedHeight <=
      windowHeight - 12;
    const top = openBelow
      ? termsAnchor.y + termsAnchor.height + gap
      : Math.max(12, termsAnchor.y - termsMenuEstimatedHeight - gap);
    const maxLeft = Math.max(8, windowWidth - termsMenuWidth - 8);
    const left = Math.min(Math.max(8, termsAnchor.x), maxLeft);
    return {
      position: "absolute" as const,
      top,
      left,
      width: termsMenuWidth,
    };
  }, [
    termsAnchor,
    termsMenuEstimatedHeight,
    termsMenuWidth,
    windowHeight,
    windowWidth,
  ]);

  return (
    <View
      style={[
        styles.sheet,
        density === "compact" && styles.sheetCompact,
        !isStandalone &&
          density !== "compact" && {
            paddingTop: insets.top > 0 ? insets.top : 16,
          },
      ]}
    >
      <View style={[styles.header, density === "compact" && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <View style={styles.headerTitleRow}>
            {onClose ? (
              <Pressable
                style={styles.backBtn}
                onPress={onClose}
                disabled={isFinalizing}
                accessibilityRole="button"
                accessibilityLabel="Close invoice draft"
                hitSlop={Layout.touchTargetHitSlop}
              >
                <FontAwesome
                  name="arrow-left"
                  size={14}
                  color={Theme.textPrimaryDark}
                />
              </Pressable>
            ) : null}
            <Text
              style={[
                styles.headerTitle,
                density === "compact" && styles.headerTitleCompact,
              ]}
            >
              {externalDraft && !readOnly
                ? "Manual Invoice Preview"
                : "Invoice Preview"}
            </Text>
            <View style={styles.draftBadge}>
              <Text style={styles.draftBadgeText}>
                {readOnly ? invoiceNumberLabel : "Draft"}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSub}>
            {readOnly
              ? `${customerLabel} · Preview date ${invoiceDateLabel}`
              : `${customerLabel} · Preview date ${invoiceDateLabel} · Number assigned on issue`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {onToggleExpand ? (
            <Pressable
              style={styles.headerIconBtn}
              onPress={onToggleExpand}
              accessibilityRole="button"
              accessibilityLabel={
                previewExpanded ? "Restore preview size" : "Expand preview"
              }
            >
              <FontAwesome
                name={previewExpanded ? "compress" : "expand"}
                size={16}
                color={Theme.textPrimaryDark}
              />
            </Pressable>
          ) : null}
          {onClose ? (
            <Pressable
              style={styles.headerIconBtn}
              onPress={onClose}
              disabled={isFinalizing}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <FontAwesome
                name="times"
                size={18}
                color={Theme.textPrimaryDark}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          previewExpanded && styles.bodyContentExpanded,
        ]}
        {...tabBarScrollProps}
      >
        <View
          style={[
            styles.document,
            previewExpanded && styles.documentExpanded,
          ]}
        >
        <View style={styles.docTitleBlock} accessibilityRole="header">
          <View style={styles.docTitleRule} />
          <Text style={styles.docTitle}>Draft Invoice</Text>
          <View style={styles.docTitleRule} />
        </View>

        {/* Customer Details — auto-filled from client finance ledger */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitle}>Customer Details</Text>
          </View>
          <View style={styles.customerNameBlock}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, styles.fieldLabelFlush]}>
                Customer Name
              </Text>
              {draft?.client.client_id && onEditClient ? (
                <Pressable
                  style={styles.editClientBtn}
                  onPress={() => onEditClient(draft.client.client_id!)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit client details"
                  hitSlop={Layout.touchTargetHitSlop}
                >
                  <FontAwesome name="pencil" size={11} color={Theme.primary} />
                  <Text style={styles.editClientBtnText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.fieldValueBox}>
              <Text style={styles.fieldValueAccent} numberOfLines={1}>
                {customerLabel}
              </Text>
            </View>
          </View>
          <View style={styles.fieldGridMeta}>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>GSTIN</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {draft?.client.gstin || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>PAN</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {draft?.client.pan || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Contact</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {draft?.client.contact_person || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {draft?.client.phone || "—"}
                </Text>
              </View>
            </View>
            <View style={[styles.fieldCell, styles.fieldCellWide]}>
              <Text style={styles.fieldLabel}>Billing Address</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={2}>
                  {draft?.client.billing_address || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {draft?.client.email || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Invoice Number</Text>
              <View style={[styles.fieldValueBox, styles.fieldValueMuted]}>
                <Text style={styles.fieldValueMutedText} numberOfLines={1}>
                  {invoiceNumberLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Terms</Text>
              <View
                ref={termsTriggerRef}
                collapsable={false}
                style={styles.settingsSelectWrap}
              >
                <Pressable
                  style={[
                    styles.settingsSelect,
                    showTermsModal && styles.settingsSelectOpen,
                  ]}
                  onPress={toggleTermsMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Payment terms"
                  accessibilityState={{ expanded: showTermsModal }}
                >
                  <Text style={styles.settingsSelectText} numberOfLines={1}>
                    {paymentTerms}
                  </Text>
                  <FontAwesome
                    name={showTermsModal ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={Theme.textMuted}
                  />
                </Pressable>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Due Date</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {dueDateLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Invoice Date</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {invoiceDateLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Transport Details */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitle}>Transport Details</Text>
          </View>
          <View style={styles.fieldGrid}>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Consignor</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {issuer?.businessName || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Consignee</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {customerLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Trip ID</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {primaryTrip?.id || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Trip Date</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {primaryTrip?.date || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>LR Number</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {lrNumberLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Pickup Location</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {primaryTrip ? pickupLabel : "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Delivery Location</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {primaryTrip ? deliveryLabel : "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Truck No</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {truckNoLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Truck Load Type</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {loadTypeLabel}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Issuer State</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {issuer?.state || "—"}
                </Text>
              </View>
            </View>
            <View style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>Issuer GSTIN</Text>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueText} numberOfLines={1}>
                  {issuer?.gstNotApplicable
                    ? "Not applicable"
                    : issuer?.gstin || "—"}
                </Text>
              </View>
            </View>
          </View>
          {selectedTrips.length > 1 ? (
            <Text style={styles.fieldHint}>
              Showing transport for the first of {selectedTrips.length} selected
              trips. All trips appear in Items below.
            </Text>
          ) : null}
        </View>

        {/* Items table */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleBarInline}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>
                Items
              </Text>
            </View>
            {selectedTrips.length > 0 ? (
              <View style={styles.splitToggleRow}>
                <Pressable
                  style={[
                    styles.splitToggleBtn,
                    showSplit && styles.splitToggleBtnOn,
                  ]}
                  onPress={() => setShowSplit(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showSplit }}
                  accessibilityLabel="Show split"
                >
                  <Text
                    style={[
                      styles.splitToggleText,
                      showSplit && styles.splitToggleTextOn,
                    ]}
                  >
                    Show split
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.splitToggleBtn,
                    !showSplit && styles.splitToggleBtnOn,
                  ]}
                  onPress={() => setShowSplit(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !showSplit }}
                  accessibilityLabel="No split"
                >
                  <Text
                    style={[
                      styles.splitToggleText,
                      !showSplit && styles.splitToggleTextOn,
                    ]}
                  >
                    No split
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.itemsTable}>
            <View style={styles.itemsHead}>
              <Text style={[styles.itemsHeadCell, styles.colIndex]}>#</Text>
              <Text style={[styles.itemsHeadCell, styles.colDesc]}>
                Item & Description
              </Text>
              <Text style={[styles.itemsHeadCell, styles.colRoute]}>
                Reference
              </Text>
              <Text
                style={[
                  styles.itemsHeadCell,
                  styles.colAmount,
                  styles.itemsHeadRight,
                ]}
              >
                Amount
              </Text>
            </View>

            {globalCharges.map((charge, index) => (
              <View key={charge.id} style={styles.chargeRow}>
                <Text style={[styles.itemsBodyCell, styles.colIndex]}>
                  {index + 1}
                </Text>
                <View style={[styles.chargeContentCol, styles.colDesc]}>
                  <TextInput
                    style={styles.chargeInput}
                    value={charge.description}
                    onChangeText={(t) =>
                      handleUpdateCharge(charge.id, "description", t)
                    }
                    placeholder="Enter description"
                    placeholderTextColor={Theme.textMuted}
                  />
                  <Text style={styles.chargeHint} numberOfLines={1}>
                    Global adjustment
                  </Text>
                </View>
                <View style={[styles.chargeActionsRow, styles.colAmountWide]}>
                  <View style={styles.chargeTypeToggle}>
                    <Pressable
                      style={[
                        styles.chargeTypeBtn,
                        !Object.is(charge.amount, -0) && charge.amount >= 0
                          ? styles.chargeTypeBtnAdd
                          : null,
                      ]}
                      onPress={() =>
                        handleUpdateCharge(
                          charge.id,
                          "amount",
                          Math.abs(charge.amount),
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.chargeTypeText,
                          !Object.is(charge.amount, -0) && charge.amount >= 0
                            ? styles.chargeTypeTextAdd
                            : null,
                        ]}
                      >
                        Add
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.chargeTypeBtn,
                        Object.is(charge.amount, -0) || charge.amount < 0
                          ? styles.chargeTypeBtnMinus
                          : null,
                      ]}
                      onPress={() =>
                        handleUpdateCharge(
                          charge.id,
                          "amount",
                          Object.is(charge.amount, 0)
                            ? -0
                            : -Math.abs(charge.amount),
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.chargeTypeText,
                          Object.is(charge.amount, -0) || charge.amount < 0
                            ? styles.chargeTypeTextMinus
                            : null,
                        ]}
                      >
                        Minus
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.chargeAmountWrapper}>
                    <Text style={styles.chargeCurrencySymbol}>₹</Text>
                    <TextInput
                      style={styles.chargeAmountInput}
                      value={Math.abs(charge.amount).toString()}
                      onChangeText={(t) => {
                        const val = parseFloat(t) || 0;
                        const isNeg =
                          Object.is(charge.amount, -0) || charge.amount < 0;
                        handleUpdateCharge(
                          charge.id,
                          "amount",
                          isNeg ? (val === 0 ? -0 : -val) : val,
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <Pressable
                    style={styles.removeChargeBtn}
                    onPress={() => handleRemoveCharge(charge.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove charge"
                  >
                    <FontAwesome
                      name="trash-o"
                      size={14}
                      color={Theme.negative}
                    />
                  </Pressable>
                </View>
              </View>
            ))}

            {previewItemSource === "draft-lines" ? (
              previewLines.map((line, index) => (
                <View
                  key={`${line.trip_ref ?? line.description}-${index}`}
                  style={styles.tripItemWrapper}
                  accessibilityLabel={`Preview line ${index + 1}`}
                >
                  <View style={styles.tripItem}>
                    <Text style={[styles.itemsBodyCell, styles.colIndex]}>
                      {index + 1}
                    </Text>
                    <View style={[styles.tripItemMeta, styles.colDesc]}>
                      <Text style={styles.tripItemId} numberOfLines={2}>
                        {line.description}
                      </Text>
                      <Text style={styles.tripItemDate} numberOfLines={1}>
                        {[line.trip_ref, line.hsn_sac ? `HSN ${line.hsn_sac}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                    </View>
                    <Text style={[styles.itemsBodyCell, styles.colRoute]} numberOfLines={1}>
                      {line.qty} × {line.rate}
                    </Text>
                    <Text style={[styles.itemsBodyCell, styles.colStatus]}>
                      {line.line_type}
                    </Text>
                    <Text
                      style={[
                        styles.itemsBodyCell,
                        styles.colAmount,
                        styles.itemsHeadRight,
                      ]}
                    >
                      {formatCurrency(line.taxable_value)}
                    </Text>
                  </View>
                </View>
              ))
            ) : previewItemSource === "empty" ? (
              <View style={styles.emptyTrips}>
                <FontAwesome
                  name="file-text-o"
                  size={22}
                  color={Theme.borderMedium}
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.emptyTripsText}>
                  Select one or more eligible trips or enter manual lines.
                </Text>
              </View>
            ) : (
              selectedTrips.map((trip, index) => {
                const tripKey = trip.internal_id || trip.id;
                const billingTrip =
                  billingTrips.find(
                    (t) => (t.internal_id || t.id) === tripKey,
                  ) ?? trip;
                const tripNotes = adjustmentsForTripId(
                  tripAdjustmentsRecord,
                  trip.internal_id,
                );
                const baseAmount = billingTrip.amount;
                const revised = invoiceTripAdjustedAmount(
                  baseAmount,
                  tripNotes,
                );
                const hasSplit = Math.abs(revised - baseAmount) >= 0.005;
                const rowNum = globalCharges.length + index + 1;
                const amountText =
                  tripAmountDraftText[tripKey] ??
                  (Number.isFinite(baseAmount) ? String(baseAmount) : "0");
                return (
                  <View key={trip.id} style={styles.tripItemWrapper}>
                    <View style={styles.tripItem}>
                      <Text style={[styles.itemsBodyCell, styles.colIndex]}>
                        {rowNum}
                      </Text>
                      <View style={[styles.tripItemMeta, styles.colDesc]}>
                        <Text style={styles.tripItemId} numberOfLines={1}>
                          {selectedTrips.length > 1
                            ? `Freight charges · ${trip.id}`
                            : "Base freight"}
                        </Text>
                        <Text style={styles.tripItemDate} numberOfLines={2}>
                          {trip.route}
                        </Text>
                      </View>
                      <Text
                        style={[styles.tripItemRoute, styles.colRoute]}
                        numberOfLines={2}
                      >
                        {trip.id}
                      </Text>
                      <View style={[styles.tripItemAmounts, styles.colAmount]}>
                        <View style={styles.tripAmountEdit}>
                          <Text style={styles.tripAmountCurrency}>₹</Text>
                          <TextInput
                            style={styles.tripAmountInput}
                            value={amountText}
                            onChangeText={(t) =>
                              handleUpdateTripAmount(tripKey, t)
                            }
                            onBlur={() =>
                              handleBlurTripAmount(tripKey, trip.amount)
                            }
                            keyboardType="decimal-pad"
                            accessibilityLabel={`Edit freight amount for ${trip.id}`}
                            selectTextOnFocus
                          />
                        </View>
                        {showSplit && hasSplit ? (
                          <Text style={styles.tripItemBaseAmount}>
                            With CN/DN {formatCurrency(revised)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <InvoiceTripCnDnGroup
                      trip={billingTrip}
                      adjustments={tripNotes}
                      showBreakdown={showSplit}
                      onAdd={() => {
                        setCnDnEdit(null);
                        setCnDnTrip(trip);
                      }}
                      onEdit={(adj) => {
                        setCnDnEdit(adj);
                        setCnDnTrip(trip);
                      }}
                    />
                  </View>
                );
              })
            )}
          </View>

          <Pressable
            style={styles.addChargeBtn}
            onPress={() => handleAddCharge()}
            accessibilityRole="button"
            accessibilityLabel="Add item"
          >
            <FontAwesome name="plus" size={12} color={Theme.analyticsHeroBg} />
            <Text style={styles.addChargeText}>Add Item</Text>
          </Pressable>
        </View>

        {/* Terms & Conditions */}
        <View style={[styles.section, styles.settingsBlock]}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add special instructions, PO references, or payment notes…"
            placeholderTextColor={Theme.textMuted}
            multiline
            numberOfLines={3}
          />

          <View style={styles.settingsToggles}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setIncludeGst(!includeGst)}
            >
              <View
                style={[styles.checkbox, includeGst && styles.checkboxActive]}
              >
                {includeGst && (
                  <FontAwesome
                    name="check"
                    size={10}
                    color={Theme.screenBackground}
                  />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Apply GST</Text>
              {includeGst && (
                <View style={styles.rateInputWrap}>
                  <TextInput
                    style={styles.rateInput}
                    value={String(gstRate)}
                    onChangeText={(t) => setGstRate(Number.parseFloat(t) || 0)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rateSuffix}>%</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setIncludeFuel(!includeFuel)}
            >
              <View
                style={[styles.checkbox, includeFuel && styles.checkboxActive]}
              >
                {includeFuel && (
                  <FontAwesome
                    name="check"
                    size={10}
                    color={Theme.screenBackground}
                  />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Fuel Surcharge</Text>
              {includeFuel && (
                <View style={styles.rateInputWrap}>
                  <TextInput
                    style={styles.rateInput}
                    value={String(fuelRate)}
                    onChangeText={(t) => setFuelRate(Number.parseFloat(t) || 0)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.rateSuffix}>%</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.calcBlock}>
          {taxDisplay?.warning ? (
            <Text style={styles.taxWarning}>{taxDisplay.warning}</Text>
          ) : null}
          {(taxDisplay?.rows ?? []).map((row) => (
            <View
              key={row.key}
              style={[
                styles.calcRow,
                row.key === "taxable" ? styles.calcRowTaxable : null,
              ]}
            >
              <Text
                style={
                  row.key === "taxable"
                    ? styles.calcLabelSubtotal
                    : styles.calcLabel
                }
              >
                {row.label}
              </Text>
              <Text
                style={
                  row.key === "taxable" ? styles.calcValSubtotal : styles.calcVal
                }
              >
                {row.value}
              </Text>
            </View>
          ))}
          <View style={styles.calcSubtotal} />
          <View style={styles.balanceDueBar}>
            <View style={styles.balanceDueCopy}>
              <Text style={styles.balanceDueLabel}>Balance Due</Text>
              <Text style={styles.balanceDueSub}>
                {readOnly ? invoiceNumberLabel : "Draft — not issued"}
              </Text>
            </View>
            <Text style={styles.balanceDueValue}>
              {formatCurrency(draft?.tax.total_amount ?? 0)}
            </Text>
          </View>
        </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          invoiceBuildBlockedReason ? styles.footerBlocked : null,
          {
            paddingBottom: isStandalone
              ? layout.scrollBottomPadding(12)
              : insets.bottom + 16,
          },
        ]}
      >
        {invoiceBuildBlockedReason ? (
          <Text style={styles.buildGateReason}>{invoiceBuildBlockedReason}</Text>
        ) : invoiceIssueBlockedReason ? (
          <Text style={styles.buildGateReason}>{invoiceIssueBlockedReason}</Text>
        ) : null}
        {readOnly ? null : (
        <Pressable
          style={[
            styles.footerBtnSecondary,
            (isFinalizing ||
              isIssuing ||
              !canSaveDraft) &&
              styles.btnDisabled,
          ]}
          onPress={onSaveDraft ?? handleInitiatePreview}
          disabled={
            isFinalizing ||
            isIssuing ||
            !canSaveDraft
          }
          accessibilityLabel={
            invoiceBuildBlockedReason ??
            (onSaveDraft ? saveDraftLabel : "Preview draft")
          }
        >
          {isFinalizing ? (
            <LoadingIndicator color={Theme.analyticsHeroBg} size="small" />
          ) : (
            <>
              <FontAwesome
                name="file-text-o"
                size={13}
                color={Theme.analyticsHeroBg}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.footerBtnSecondaryText}>
                {onSaveDraft ? saveDraftLabel : "Preview draft"}
              </Text>
            </>
          )}
        </Pressable>
        )}
        {readOnly ? (
          <Pressable
            style={styles.footerBtnPrimary}
            onPress={handleInitiatePreview}
            disabled={selectedTrips.length === 0}
            accessibilityLabel="Download PDF"
          >
            <Text style={styles.footerBtnPrimaryText}>Download PDF</Text>
          </Pressable>
        ) : (
        <Pressable
          style={[
            styles.footerBtnPrimary,
            issueBlocked && styles.btnDisabled,
          ]}
          onPress={handleIssueInvoice}
          disabled={issueBlocked}
          accessibilityLabel="Issue Invoice"
        >
          {isIssuing ? (
            <LoadingIndicator color={Theme.screenBackground} size="small" />
          ) : (
            <Text style={styles.footerBtnPrimaryText}>Issue Invoice</Text>
          )}
        </Pressable>
        )}
      </View>
      <Modal
        visible={showTermsModal}
        transparent
        animationType="fade"
        onRequestClose={closeTermsMenu}
      >
        <View style={styles.termsMenuRoot} pointerEvents="box-none">
          <Pressable
            style={styles.termsMenuBackdrop}
            onPress={closeTermsMenu}
            accessibilityRole="button"
            accessibilityLabel="Dismiss payment terms"
          />
          <View
            style={[
              styles.termsMenuPanel,
              termsMenuStyle ?? styles.termsMenuPanelFallback,
            ]}
            accessibilityRole="menu"
          >
            {PAYMENT_TERMS_OPTIONS.map((term) => {
              const selected = paymentTerms === term;
              return (
                <Pressable
                  key={term}
                  style={[
                    styles.termOption,
                    selected && styles.termOptionSelected,
                  ]}
                  onPress={() => selectPaymentTerm(term)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.termOptionText,
                      selected && styles.termOptionActive,
                    ]}
                  >
                    {term}
                  </Text>
                  {selected ? (
                    <FontAwesome
                      name="check"
                      size={13}
                      color={Theme.analyticsHeroBg}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <ProvisionAdjustmentModal
        visible={cnDnTrip != null}
        side="client"
        onClose={closeCnDnModal}
        onSave={handleSaveTripCnDn}
        onUpdate={handleUpdateTripCnDn}
        editTarget={cnDnEdit}
        tripCode={cnDnTrip?.id}
        partyLabel={activeClient}
        clientName={activeClient || cnDnTrip?.client || "Client"}
        supplierName={cnDnTrip?.supplier_name || "Supplier"}
        sales={cnDnBillingAmount}
        adjSales={invoiceTripAdjustedAmount(
          cnDnBillingAmount,
          cnDnTrip
            ? adjustmentsForTripId(tripAdjustmentsRecord, cnDnTrip.internal_id)
            : [],
        )}
        cost={0}
        adjCost={0}
        revenueSideDelta={
          cnDnTrip
            ? invoiceTripAdjustedAmount(
                cnDnBillingAmount,
                adjustmentsForTripId(tripAdjustmentsRecord, cnDnTrip.internal_id),
              ) - cnDnBillingAmount
            : 0
        }
        costSideDelta={0}
        adjustments={
          cnDnTrip
            ? adjustmentsForTripId(tripAdjustmentsRecord, cnDnTrip.internal_id)
            : []
        }
        lineMetaLabel={(adj) =>
          (adj.reason ?? "").trim() ||
          (adj.impact === "minus" ? "Credit note" : "Debit note")
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: Theme.analyticsCanvas,
    flex: 1,
  },
  sheetCompact: {
    backgroundColor: Theme.screenBackground,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 16,
    minHeight: 68,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.3,
  },
  headerCompact: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 8,
    minHeight: 44,
  },
  headerTitleCompact: {
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  draftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Theme.accentBrownWash,
    borderWidth: 1,
    borderColor: Theme.accentBrownBorder,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.accentBrown,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  headerSub: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: {
    width: Layout.minTouchTargetSize,
    height: Layout.minTouchTargetSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  body: { flex: 1, backgroundColor: Theme.analyticsCanvas },
  bodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    flexGrow: 1,
  },
  bodyContentExpanded: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  document: {
    width: "100%",
    flexGrow: 1,
    alignSelf: "stretch",
    backgroundColor: Theme.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 0,
  },
  documentExpanded: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
  },
  docTitleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  docTitleRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.accentBrown,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Theme.accentBrown,
  },

  section: {
    marginBottom: 26,
  },
  sectionTitleBar: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: Theme.accentBrown,
  },
  sectionTitleBarInline: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: Theme.accentBrown,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.accentBrownDeep,
    marginBottom: 0,
    letterSpacing: -0.1,
  },
  sectionTitleInline: {
    marginBottom: 0,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.analyticsHeroBg,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldLabelFlush: {
    marginBottom: 0,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "400",
    color: Theme.textMuted,
    lineHeight: 15,
  },
  multiTripBlock: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: Theme.accentBrownBorder,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  multiTripSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Theme.accentBrownWash,
    borderBottomWidth: 1,
    borderBottomColor: Theme.accentBrownBorder,
  },
  multiTripSummaryTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "800",
    color: Theme.accentBrownDeep,
  },
  multiTripSummaryValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.accentBrown,
  },
  multiTripHint: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
    lineHeight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  multiTripRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  multiTripIndex: {
    width: 22,
    fontSize: 12,
    fontWeight: "800",
    color: Theme.textMuted,
    marginTop: 2,
  },
  multiTripMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  multiTripId: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  multiTripRoute: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimary,
  },
  multiTripMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  multiTripAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    marginTop: 2,
  },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    ...(Platform.OS === "web"
      ? ({
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          alignItems: "start",
        } as unknown as ViewStyle)
      : null),
  },
  fieldGridMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 14,
    ...(Platform.OS === "web"
      ? ({
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          alignItems: "start",
        } as unknown as ViewStyle)
      : null),
  },
  customerNameBlock: {
    width: "100%",
    minWidth: 0,
  },
  fieldCell: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 140,
    maxWidth: "100%",
    ...(Platform.OS === "web"
      ? ({
          width: "100%",
          flexBasis: "auto",
          minWidth: 0,
        } as unknown as ViewStyle)
      : null),
  },
  fieldCellWide: {
    flexBasis: 220,
    minWidth: 180,
    ...(Platform.OS === "web"
      ? ({
          gridColumn: "1 / -1",
          flexBasis: "auto",
          minWidth: 0,
        } as unknown as ViewStyle)
      : null),
  },
  fieldValueBox: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 6,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  fieldValueMuted: {
    backgroundColor: Theme.surface,
  },
  fieldValueText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  fieldValueAccent: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.accentBrown,
  },
  fieldValueMutedText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  editClientBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 2,
    marginBottom: 0,
  },
  editClientBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.analyticsHeroBg,
  },

  clientName: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    marginBottom: 4,
  },
  clientAddress: {
    fontSize: 12,
    fontWeight: "400",
    color: Theme.textRouteCard,
    marginBottom: 2,
    lineHeight: 17,
  },

  itemsTable: {
    borderWidth: 1,
    borderColor: Theme.accentBrownBorder,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  itemsHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.accentBrown,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  itemsHeadCell: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textOnDark,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  itemsHeadRight: {
    textAlign: "right",
  },
  colStatus: {
    flex: 0.9,
    minWidth: 72,
  },
  itemsBodyCell: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
  colIndex: {
    width: 28,
    flexShrink: 0,
  },
  colDesc: {
    flex: 1.4,
    minWidth: 100,
  },
  colRoute: {
    flex: 1.4,
    minWidth: 100,
  },
  colAmount: {
    width: 128,
    flexShrink: 0,
    alignItems: "flex-end",
  },
  colAmountWide: {
    flexShrink: 0,
    marginLeft: "auto",
  },

  addChargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: Layout.minTouchTargetSize,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 10,
  },
  addChargeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.analyticsHeroBg,
  },

  chargeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.surfaceBorder,
    backgroundColor: Theme.cardWhite,
  },
  chargeContentCol: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 100,
  },
  chargeActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  chargeInput: {
    width: "100%",
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
    padding: 0,
    margin: 0,
    minHeight: 20,
  },
  chargeHint: {
    fontSize: 11,
    fontWeight: "400",
    color: Theme.textMuted,
    marginTop: 2,
  },

  chargeTypeToggle: {
    flexDirection: "row",
    backgroundColor: Theme.surfaceGray,
    padding: 2,
    borderRadius: 6,
  },
  chargeTypeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 4,
    justifyContent: "center",
  },
  chargeTypeBtnAdd: {
    backgroundColor: Theme.cardWhite,
  },
  chargeTypeBtnMinus: {
    backgroundColor: Theme.cardWhite,
  },
  chargeTypeText: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  chargeTypeTextAdd: { color: Theme.positive },
  chargeTypeTextMinus: { color: Theme.negative },

  chargeAmountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: 78,
  },
  chargeCurrencySymbol: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    marginRight: 2,
  },
  chargeAmountInput: {
    width: 48,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
    textAlign: "right",
    padding: 0,
    margin: 0,
  },
  removeChargeBtn: {
    width: Layout.minTouchTargetSize,
    height: Layout.minTouchTargetSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  splitToggleRow: {
    flexDirection: "row",
    alignSelf: "flex-end",
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  splitToggleBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  splitToggleBtnOn: {
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
  },
  splitToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textRouteCard,
  },
  splitToggleTextOn: {
    color: Theme.textPrimaryDark,
  },
  emptyTrips: {
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.cardWhite,
  },
  emptyTripsText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  tripItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.surfaceBorder,
  },
  tripItem: {
    backgroundColor: Theme.cardWhite,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tripItemMeta: { minWidth: 0 },
  tripItemAmounts: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 4,
  },
  tripItemId: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    marginBottom: 2,
  },
  tripItemDate: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  tripItemRoute: {
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textRouteCard,
    lineHeight: 17,
    minWidth: 0,
  },
  tripAmountEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    minWidth: 110,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
  },
  tripAmountCurrency: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textMuted,
  },
  tripAmountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
    textAlign: "right",
    paddingVertical: 4,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as unknown as TextStyle,
    }),
  },
  tripItemBaseAmount: {
    fontSize: 11,
    fontWeight: "400",
    color: Theme.textMuted,
    textAlign: "right",
  },

  calcBlock: {
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calcRowTaxable: {
    marginBottom: 12,
  },
  calcLabel: { fontSize: 13, color: Theme.textRouteCard, fontWeight: "500" },
  calcVal: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
  },
  calcSubtotal: {
    borderTopWidth: 1,
    borderTopColor: Theme.borderMedium,
    marginVertical: 8,
  },
  calcLabelSubtotal: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  calcValSubtotal: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
  },
  taxWarning: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.warning,
    marginBottom: 12,
  },
  calcTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 4,
  },
  calcTotalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  calcTotalSub: {
    fontSize: 12,
    fontWeight: "400",
    color: Theme.textMuted,
    marginTop: 2,
  },
  calcTotalVal: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
  },
  balanceDueBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginHorizontal: -14,
    marginBottom: -10,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Theme.accentBrown,
  },
  balanceDueCopy: {
    flex: 1,
    minWidth: 0,
  },
  balanceDueLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textOnDark,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  balanceDueSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
  },
  balanceDueValue: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textOnDark,
    letterSpacing: -0.3,
  },

  settingsBlock: {
    position: "relative",
    overflow: "visible",
    zIndex: 10,
  },
  settingsSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
  },
  settingsSelectWrap: {
    position: "relative",
    zIndex: 1000,
  },
  settingsSelectText: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
  },
  notesInput: {
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "400",
    color: Theme.textPrimaryDark,
    minHeight: 88,
    textAlignVertical: "top",
    position: "relative",
    zIndex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
  },
  settingsToggles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.surfaceBorder,
    paddingTop: 14,
    marginTop: 14,
    position: "relative",
    zIndex: 1,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: Layout.minTouchTargetSize,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.cardWhite,
  },
  checkboxActive: {
    backgroundColor: Theme.analyticsHeroBg,
    borderColor: Theme.analyticsHeroBg,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimary,
  },
  rateInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rateInput: {
    width: 36,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
    textAlign: "right",
    padding: 0,
    margin: 0,
  },
  rateSuffix: {
    fontSize: 13,
    fontWeight: "400",
    color: Theme.textMuted,
    marginLeft: 2,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: Theme.cardWhite,
    borderTopWidth: 1,
    borderTopColor: Theme.borderMedium,
  },
  footerBlocked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  buildGateReason: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
    textAlign: "center",
  },
  footerBtnSecondary: {
    minWidth: 140,
    minHeight: Layout.minTouchTargetSize,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1.5,
    borderColor: Theme.analyticsHeroBg,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  footerBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.analyticsHeroBg,
  },
  footerBtnPrimary: {
    minWidth: 148,
    minHeight: Layout.minTouchTargetSize,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: Theme.analyticsHeroBg,
    borderWidth: 0,
    borderColor: Theme.analyticsHeroBg,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  footerBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.screenBackground,
  },
  btnDisabled: { opacity: 0.5 },

  termsMenuRoot: {
    flex: 1,
  },
  termsMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  termsMenuPanel: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    paddingVertical: 4,
    shadowColor: Theme.textPrimaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1000,
    overflow: "hidden",
  },
  termsMenuPanelFallback: {
    position: "absolute",
    top: 120,
    left: 24,
    right: 24,
    maxWidth: 320,
    alignSelf: "center",
  },
  termOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    minHeight: Layout.minTouchTargetSize,
  },
  termOptionSelected: {
    backgroundColor: Theme.brandBlueSoft,
  },
  termOptionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  termOptionActive: { color: Theme.analyticsHeroBg, fontWeight: "700" },
  settingsSelectOpen: {
    borderColor: Theme.accentBrown,
  },
});
