import Theme from "@/constants/Theme";
import {
  guessCompliancePreviewMime,
  signCompliancePreviewUrl,
} from "@/features/tripCompliance/services/complianceDocumentView.service";
import type { ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import {
  COMPLIANCE_DEFAULT_ADVANCE_PERCENT,
  COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER,
  computeCompliancePaymentAmount,
  computeComplianceTdsAmount,
  resolveComplianceTdsRate,
} from "@/features/tripCompliance/utils/compliancePaymentAmount.util";
import { classifyTripDocument } from "@/features/tripCompliance/utils/tripDocumentClassification.util";
import {
  getVendorOnboardingProfile,
  listSupplierTdsRates,
} from "@/features/suppliers/services/supplierVendorOnboarding.service";
import {
  getSupplierById,
  getSupplierDetails,
} from "@/features/suppliers/services/suppliers.service";
import { financialYearOf } from "@/features/suppliers/utils/supplierVendorOnboarding.util";
import {
  getTripDisplayNumber,
  type TripRow,
} from "@/features/trips/services/trips.service";
import {
  getVehicleById,
  getVehicleForTripViewer,
} from "@/features/vehicles/services/vehicles.service";
import { PAYMENT_MODES } from "@/lib/paymentModes";
import { Eye } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

type PaymentTripFacts = TripRow & {
  sale_unit_rate?: number | null;
  sale_rate_basis?: string | null;
  supplier_rate_basis?: string | null;
};

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function supplierCostTotal(trip: PaymentTripFacts): number | null {
  const rate = Number(trip.supplier_rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (trip.supplier_rate_basis === "per_mt") {
    const tons = Number(trip.load_tons);
    if (Number.isFinite(tons) && tons > 0) return rate * tons;
    return null;
  }
  return rate;
}

/** Base supplier freight for this Compliance payment category (Record payment “revised cost”). */
function baseFreightAmount(
  trip: PaymentTripFacts | undefined,
  category: ComplianceLedgerCategory | null,
  advancePaid: number | null | undefined,
): number | null {
  if (!trip) return null;
  const total = supplierCostTotal(trip);
  if (total == null) return null;
  if (category === "compliance_balance") {
    const paid = Number(advancePaid);
    if (Number.isFinite(paid) && paid > 0) {
      return Math.max(0, total - paid);
    }
  }
  return total;
}

const INLINE_TWO_COLUMN_MIN_WIDTH = 600;
/** Inline action buttons are drawn 36pt tall; keep the touch target at 44pt. */
const INLINE_ACTION_HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

function FactRow({
  label,
  value,
  emphasize,
  compact,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.factRow,
        compact && styles.factRowCompact,
        emphasize && styles.factRowEmphasize,
      ]}
    >
      <Text style={[styles.factLabel, emphasize && styles.factLabelEmphasize]}>
        {label}
      </Text>
      <Text
        style={[styles.factValue, emphasize && styles.factValueEmphasize]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function sanitizePercentInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned.slice(0, 5);
  return `${parts[0].slice(0, 3)}.${parts.slice(1).join("").slice(0, 2)}`;
}

export type CompliancePaymentConfirmValues = {
  amount: number;
  paymentModeId: string;
  paymentModeLabel: string;
  utr?: string;
  remark?: string;
};

export function CompliancePaymentConfirmModal({
  visible,
  summary,
  category,
  submitting,
  onCancel,
  onConfirm,
  onReject,
  presentation = "modal",
}: {
  visible: boolean;
  summary: ComplianceTripSummary | null;
  category: ComplianceLedgerCategory | null;
  submitting: boolean;
  onCancel?: () => void;
  onConfirm: (values: CompliancePaymentConfirmValues) => void;
  /** Inline only: trip-level Reject shown beside Confirm payment. */
  onReject?: () => void;
  /** `inline` embeds the form in the Advance Payment panel (no popup). */
  presentation?: "modal" | "inline";
}) {
  const { height } = useWindowDimensions();
  const isInline = presentation === "inline";
  const [advancePercentText, setAdvancePercentText] = useState(
    String(COMPLIANCE_DEFAULT_ADVANCE_PERCENT),
  );
  const [modeId, setModeId] = useState<string>("UPI");
  const [truckType, setTruckType] = useState<string | null>(null);
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null);
  const [memoOpening, setMemoOpening] = useState(false);
  const [tdsRatePercent, setTdsRatePercent] = useState<number | null>(null);
  const [tdsRateFy, setTdsRateFy] = useState<string | null>(null);
  const [tdsLoading, setTdsLoading] = useState(false);
  const [inlineWidth, setInlineWidth] = useState(0);
  const inlineWide = inlineWidth >= INLINE_TWO_COLUMN_MIN_WIDTH;

  const trip = summary?.trip as PaymentTripFacts | undefined;
  const categoryLabel =
    category === "compliance_balance" ? "balance" : "advance";
  const isAdvance = category !== "compliance_balance";
  const baseFreight = useMemo(
    () => baseFreightAmount(trip, category, summary?.advance?.amount),
    [trip, category, summary?.advance?.amount],
  );
  const baseFreightLabel = baseFreight != null ? formatInr(baseFreight) : "—";
  const documentationCharges = COMPLIANCE_PAYMENT_DOC_CHARGES_PLACEHOLDER;
  const tdsAmount = useMemo(
    () => computeComplianceTdsAmount(baseFreight ?? 0, tdsRatePercent),
    [baseFreight, tdsRatePercent],
  );
  const advancePercent = Number(advancePercentText);
  const computedAmount = useMemo(() => {
    if (baseFreight == null) return 0;
    return computeCompliancePaymentAmount({
      baseFreight,
      advancePercent: Number.isFinite(advancePercent) ? advancePercent : 0,
      documentationCharges,
      tdsAmount,
    });
  }, [baseFreight, advancePercent, documentationCharges, tdsAmount]);
  const tripLabel = trip
    ? getTripDisplayNumber(trip, trip.organization_id ?? null)
    : "—";
  const percentLabel = isAdvance ? "Advance %" : "Settlement %";
  const currentFy = useMemo(() => financialYearOf(new Date()), []);
  const tdsHasRate = tdsRatePercent != null && tdsRatePercent > 0;

  const memoDocument =
    summary?.documents.find(
      (doc) =>
        (doc.document_type ?? "").toLowerCase() === "memo" &&
        classifyTripDocument(doc).hasBinary,
    ) ?? null;

  useEffect(() => {
    if (visible) {
      setAdvancePercentText(
        String(isAdvance ? COMPLIANCE_DEFAULT_ADVANCE_PERCENT : 100),
      );
      setModeId("UPI");
    } else {
      setMemoOpening(false);
      setTdsRatePercent(null);
      setTdsRateFy(null);
    }
  }, [visible, summary?.trip.id, category, isAdvance]);

  useEffect(() => {
    const vehicleId = trip?.vehicle_id?.trim();
    const orgId = trip?.organization_id?.trim();
    if (!visible || !trip || !vehicleId || !orgId) {
      setTruckType(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const owned = await getVehicleById(orgId, vehicleId);
      const ownedType = owned.vehicle?.vehicle_type?.trim() || "";
      if (ownedType) {
        if (!cancelled) setTruckType(ownedType);
        return;
      }
      const shared = await getVehicleForTripViewer(vehicleId, trip.id, orgId);
      if (!cancelled)
        setTruckType(shared.vehicle?.vehicle_type?.trim() || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, trip]);

  useEffect(() => {
    const supplierId = trip?.supplier_id?.trim();
    const orgId = trip?.organization_id?.trim();
    const fallback = trip?.supplier_name?.trim() || null;
    if (!visible || !supplierId) {
      setSupplierLabel(fallback);
      return;
    }
    let cancelled = false;
    void (async () => {
      let label = "";
      const details = await getSupplierDetails(supplierId);
      label =
        details.supplier?.name?.trim() ||
        details.supplier?.company_name?.trim() ||
        details.supplier?.contact_person?.trim() ||
        "";
      if (!label && orgId) {
        const owned = await getSupplierById(orgId, supplierId);
        label =
          owned.supplier?.name?.trim() ||
          owned.supplier?.company_name?.trim() ||
          owned.supplier?.contact_person?.trim() ||
          "";
      }
      if (!cancelled) setSupplierLabel(label || fallback);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, trip?.supplier_id, trip?.organization_id, trip?.supplier_name]);

  /** Load vendor advance % + FY TDS rate from supplier vault (source of truth). */
  useEffect(() => {
    const supplierId = trip?.supplier_id?.trim();
    const orgId = trip?.organization_id?.trim();
    if (!visible || !supplierId || !orgId) {
      setTdsRatePercent(null);
      setTdsRateFy(null);
      setTdsLoading(false);
      return;
    }
    let cancelled = false;
    setTdsLoading(true);
    void (async () => {
      const [tds, profile] = await Promise.all([
        listSupplierTdsRates(orgId, supplierId),
        getVendorOnboardingProfile(orgId, supplierId),
      ]);
      if (cancelled) return;
      const resolved = resolveComplianceTdsRate(tds.rates);
      setTdsRatePercent(resolved?.ratePercent ?? null);
      setTdsRateFy(resolved?.financialYear ?? null);
      const adv = profile.profile?.advance_percentage;
      const vendorPct =
        adv != null && Number.isFinite(Number(adv)) ? Number(adv) : null;
      if (isAdvance && vendorPct != null) {
        setAdvancePercentText(String(vendorPct));
      }
      setTdsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, trip?.supplier_id, trip?.organization_id, isAdvance]);

  const amountOk = computedAmount > 0;
  const mode = PAYMENT_MODES.find((item) => item.id === modeId);
  const canSubmit =
    amountOk && !!mode && !submitting && !!summary && !!category;

  const openMemoPreview = async () => {
    const path = memoDocument?.storage_path?.trim();
    const orgId = trip?.organization_id?.trim();
    if (!path || !orgId) {
      alertMessage("Memo document", "This trip has no memo file to preview.");
      return;
    }
    setMemoOpening(true);
    try {
      const url = await signCompliancePreviewUrl({
        storagePath: path,
        source: "trip",
        sourceEntityDocumentId: memoDocument?.source_entity_document_id,
        organizationId: orgId,
        docType: "memo",
      });
      if (!url) {
        alertMessage("Memo document", "This trip has no memo file to preview.");
        return;
      }
      // Keep preview out of DocumentScreen to avoid a Workspace ↔ Modal import cycle.
      void guessCompliancePreviewMime(
        memoDocument?.file_name || path,
        memoDocument?.mime_type,
      );
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
          alertMessage(
            "Memo document",
            "Could not open the memo preview on this device.",
          );
          return;
        }
        await Linking.openURL(url);
      }
    } finally {
      setMemoOpening(false);
    }
  };

  const article = categoryLabel === "advance" ? "an" : "a";
  const confirmText = amountOk
    ? `Confirm ${categoryLabel} payment of ₹${computedAmount.toLocaleString("en-IN")}`
    : `Confirm ${categoryLabel} payment`;

  const introText = (
    <Text style={[styles.body, isInline && styles.bodyInline]}>
      You are about to post {article} {categoryLabel} payment through the
      Finance ledger. This cannot be undone from Compliance.
    </Text>
  );

  const factsCard = (
    <View style={[styles.factCard, isInline && styles.factCardInline]}>
      <FactRow
        label="Supplier"
        value={supplierLabel?.trim() || "—"}
        compact={isInline}
      />
      <FactRow
        label="Customer name"
        value={trip?.client_name?.trim() || "—"}
        compact={isInline}
      />
      <FactRow
        label="Truck type"
        value={truckType?.trim() || "—"}
        compact={isInline}
      />
      <FactRow label="Trip" value={tripLabel} compact={isInline} />
      <FactRow label="Category" value={categoryLabel} compact={isInline} />
      <FactRow
        label="Base freight"
        value={baseFreightLabel}
        emphasize
        compact={isInline}
      />
      <View style={[styles.factRow, isInline && styles.factRowCompact]}>
        <Text style={styles.factLabel}>Memo</Text>
        <View style={styles.docAction}>
          <Pressable
            style={[
              styles.eyeBtn,
              (!memoDocument || memoOpening || submitting) &&
                styles.eyeBtnDisabled,
            ]}
            onPress={() => void openMemoPreview()}
            disabled={memoOpening || submitting || !memoDocument}
            accessibilityRole="button"
            accessibilityLabel="Preview memo document"
            accessibilityState={{
              disabled: !memoDocument || memoOpening || submitting,
            }}
          >
            {memoOpening ? (
              <ActivityIndicator size="small" color={Theme.textPrimaryDark} />
            ) : (
              <>
                <Eye
                  size={13}
                  color={Theme.textPrimaryDark}
                  strokeWidth={2.2}
                />
                <Text style={styles.eyeText}>Preview</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );

  const calcRowStyle = [styles.calcRow, isInline && styles.calcRowCompact];

  const calcCard = (
    <View style={[styles.calcCard, isInline && styles.calcCardInline]}>
      <Text style={styles.calcTitle}>Amount calculation</Text>
      <Text style={styles.calcHint}>
        (Base freight × {percentLabel}) − Documentation charges − TDS
      </Text>

      <View style={calcRowStyle}>
        <Text style={[styles.calcLabel, styles.calcLabelGrow]}>
          Base freight
        </Text>
        <Text style={styles.calcValue}>{baseFreightLabel}</Text>
      </View>

      <View style={calcRowStyle}>
        <Text style={[styles.calcLabel, styles.calcLabelGrow]}>
          {percentLabel}
        </Text>
        <View style={[styles.pctField, isInline && styles.pctFieldCompact]}>
          <TextInput
            style={styles.pctInput}
            keyboardType="numeric"
            value={advancePercentText}
            onChangeText={(text) =>
              setAdvancePercentText(sanitizePercentInput(text))
            }
            editable={!submitting}
            selectTextOnFocus
            accessibilityLabel={percentLabel}
            placeholder="90"
            placeholderTextColor={Theme.textMuted}
          />
          <Text style={styles.pctSuffix}>%</Text>
        </View>
      </View>

      <View style={calcRowStyle}>
        <Text style={[styles.calcLabel, styles.calcLabelGrow]}>
          Documentation charges
        </Text>
        <Text style={styles.calcValueMuted}>
          {formatInr(documentationCharges)}
        </Text>
      </View>

      <View style={[styles.calcRowTds, isInline && styles.calcRowCompact]}>
        <View style={styles.calcLabelBlock}>
          <Text style={styles.calcLabel}>TDS amount</Text>
          {tdsLoading ? (
            <Text style={styles.calcMeta}>Fetching vendor rate…</Text>
          ) : tdsHasRate ? (
            <Text style={styles.calcMeta}>
              FY {tdsRateFy} · {tdsRatePercent}% of base freight
            </Text>
          ) : (
            <Text style={styles.calcMeta}>No TDS rate for FY {currentFy}</Text>
          )}
        </View>
        <View style={styles.tdsValueBlock}>
          {tdsHasRate ? (
            <View style={styles.tdsRateChip}>
              <Text style={styles.tdsRateChipText}>{tdsRatePercent}%</Text>
            </View>
          ) : null}
          {tdsLoading ? (
            <ActivityIndicator size="small" color={Theme.textMuted} />
          ) : (
            <Text
              style={[
                styles.calcValue,
                !tdsHasRate && styles.calcValueMuted,
                tdsHasRate && styles.tdsAmountValue,
              ]}
            >
              {formatInr(tdsAmount)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.amountResult}>
        <View style={styles.amountResultCopy}>
          <Text style={styles.amountResultLabel}>
            {isAdvance
              ? "Final advance payable (₹)"
              : "Final balance payable (₹)"}
          </Text>
          <Text style={styles.amountResultHint}>
            {tdsHasRate
              ? "Auto-calculated · TDS from vendor vault"
              : "Auto-calculated · editable % above"}
          </Text>
        </View>
        <Text style={styles.amountResultValue} numberOfLines={1}>
          {formatInr(computedAmount)}
        </Text>
      </View>
    </View>
  );

  const modeField = (
    <View style={[styles.field, isInline && styles.fieldInline]}>
      <Text style={styles.label}>Payment mode</Text>
      <View style={styles.modeRow}>
        {PAYMENT_MODES.slice(0, 4).map((item) => {
          const selected = modeId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setModeId(item.id)}
              style={[
                styles.modeChip,
                isInline && styles.modeChipInline,
                selected && styles.modeChipOn,
              ]}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.modeChipText, selected && styles.modeChipTextOn]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const actionsRow = (
    <View
      style={[
        styles.actions,
        isInline && styles.actionsInline,
        isInline && onReject && styles.actionsInlineWithReject,
      ]}
    >
      {!isInline && onCancel ? (
        <Pressable
          style={styles.cancelBtn}
          onPress={onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      ) : null}
      {isInline && onReject ? (
        <Pressable
          style={({ pressed }) => [
            styles.rejectBtnInline,
            pressed && styles.rejectBtnInlinePressed,
            submitting && styles.confirmBtnDisabled,
          ]}
          onPress={onReject}
          disabled={submitting}
          hitSlop={INLINE_ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Reject trip compliance"
        >
          <Text style={styles.rejectTextInline}>Reject</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[
          styles.confirmBtn,
          isInline && styles.confirmBtnInline,
          !canSubmit && styles.confirmBtnDisabled,
        ]}
        disabled={!canSubmit}
        hitSlop={isInline ? INLINE_ACTION_HIT_SLOP : undefined}
        accessibilityRole="button"
        accessibilityLabel={confirmText}
        onPress={() => {
          if (!mode || !canSubmit) return;
          onConfirm({
            amount: computedAmount,
            paymentModeId: mode.id,
            paymentModeLabel: mode.name,
          });
        }}
      >
        {submitting ? (
          <ActivityIndicator color={Theme.buttonDarkText} />
        ) : (
          <Text style={styles.confirmText}>
            {isInline ? "Confirm payment" : "Confirm"}
          </Text>
        )}
      </Pressable>
    </View>
  );

  if (isInline) {
    if (!visible || !summary || !category) return null;
    return (
      <View
        style={styles.inlineRoot}
        onLayout={(event) => setInlineWidth(event.nativeEvent.layout.width)}
      >
        {introText}
        <View
          style={[styles.inlineColumns, inlineWide && styles.inlineColumnsWide]}
        >
          <View
            style={[styles.inlineColumn, inlineWide && styles.inlineColumnWide]}
          >
            {factsCard}
          </View>
          <View
            style={[styles.inlineColumn, inlineWide && styles.inlineColumnWide]}
          >
            {calcCard}
          </View>
        </View>
        {modeField}
        <View style={styles.inlineActionsRow}>{actionsRow}</View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={submitting ? undefined : onCancel}
        />
        <View style={[styles.sheet, { maxHeight: Math.min(height - 32, 680) }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Confirm payment</Text>
            {introText}
            {factsCard}
            {calcCard}
            {modeField}
            {actionsRow}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.overlayBackdrop,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Theme.cardWhite,
    borderRadius: 16,
    overflow: "hidden",
  },
  inlineRoot: {
    width: "100%",
    minWidth: 0,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 10,
  },
  inlineColumns: { gap: 10 },
  inlineColumnsWide: { flexDirection: "row", alignItems: "stretch" },
  inlineColumn: { minWidth: 0 },
  inlineColumnWide: { flex: 1, flexBasis: 0 },
  inlineActionsRow: {
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceCardBorder,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: Theme.textPrimaryDark },
  body: { fontSize: 12, color: Theme.textMuted, lineHeight: 16 },
  bodyInline: { fontSize: 11, lineHeight: 15, marginBottom: 2 },
  factCard: {
    borderRadius: 10,
    backgroundColor: Theme.compliancePageBg,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  factRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  factRowCompact: { minHeight: 26 },
  factCardInline: { flexGrow: 1, justifyContent: "center", paddingVertical: 6 },
  factRowEmphasize: {
    minHeight: 34,
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.complianceCardBorder,
  },
  factLabel: {
    width: 128,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  factLabelEmphasize: {
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  factValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    textAlign: "right",
  },
  factValueEmphasize: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.darkGreen,
  },
  docAction: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  eyeBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
  },
  eyeBtnDisabled: { opacity: 0.45 },
  eyeText: { fontSize: 11, fontWeight: "600", color: Theme.textPrimaryDark },
  calcCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  calcTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
  },
  calcHint: {
    fontSize: 10,
    fontWeight: "400",
    color: Theme.textMuted,
    marginTop: -4,
    lineHeight: 14,
  },
  calcRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  calcRowCompact: { minHeight: 28 },
  calcCardInline: { flexGrow: 1, paddingTop: 8, paddingBottom: 10, gap: 6 },
  calcRowTds: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 2,
  },
  calcLabelBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  calcLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  calcLabelGrow: {
    flex: 1,
    minWidth: 0,
  },
  calcMeta: {
    fontSize: 9,
    fontWeight: "500",
    color: Theme.textSecondary,
    letterSpacing: 0.1,
  },
  calcValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "right",
  },
  calcValueMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textSecondary,
    textAlign: "right",
  },
  tdsValueBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  tdsRateChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Theme.positiveMuted,
    borderWidth: 1,
    borderColor: Theme.positiveMutedDarkBorder,
  },
  tdsRateChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.darkGreen,
    letterSpacing: 0.2,
  },
  tdsAmountValue: {
    minWidth: 64,
    color: Theme.textPrimaryDark,
  },
  pctField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    minWidth: 88,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.compliancePageBg,
  },
  pctFieldCompact: { height: 30 },
  pctInput: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "right",
  },
  pctSuffix: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textMuted,
  },
  amountResult: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceCardBorder,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  amountResultCopy: { flex: 1, minWidth: 0, gap: 2 },
  amountResultLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
  },
  amountResultHint: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
  },
  amountResultValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: Theme.darkGreen,
  },
  field: { gap: 4 },
  fieldInline: { gap: 6 },
  label: { fontSize: 11, fontWeight: "600", color: Theme.textMuted },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modeChip: {
    flex: 1,
    height: 32,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipInline: { height: 44, borderRadius: 12 },
  modeChipOn: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    textAlign: "center",
  },
  modeChipTextOn: { color: Theme.buttonDarkText },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  actionsInline: {
    justifyContent: "center",
    marginTop: 0,
  },
  actionsInlineWithReject: { gap: 10 },
  rejectBtnInline: {
    width: 96,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.complianceStageDocsBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtnInlinePressed: { opacity: 0.8 },
  rejectTextInline: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: Theme.complianceStageDocsFg,
  },
  cancelBtn: {
    minWidth: 96,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 12, fontWeight: "600", color: Theme.textPrimaryDark },
  confirmBtn: {
    minWidth: 112,
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnInline: {
    width: 168,
    minWidth: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.buttonDarkText,
    textAlign: "center",
  },
});
