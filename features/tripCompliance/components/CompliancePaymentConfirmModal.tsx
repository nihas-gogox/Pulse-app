import Theme from "@/constants/Theme";
import type { ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import type { TripRow } from "@/features/trips/services/trips.service";
import { getVehicleById, getVehicleForTripViewer } from "@/features/vehicles/services/vehicles.service";
import { PAYMENT_MODES } from "@/lib/paymentModes";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
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
  return `₹${value.toLocaleString("en-IN")}`;
}

function ratePerMtLabel(trip: PaymentTripFacts): string {
  const saleUnit = Number(trip.sale_unit_rate);
  if (trip.sale_rate_basis === "per_mt" && Number.isFinite(saleUnit) && saleUnit > 0) {
    return formatInr(saleUnit);
  }
  const supplier = Number(trip.supplier_rate);
  if (trip.supplier_rate_basis === "per_mt" && Number.isFinite(supplier) && supplier > 0) {
    return formatInr(supplier);
  }
  if (Number.isFinite(saleUnit) && saleUnit > 0) return formatInr(saleUnit);
  return "—";
}

function loadedWeightLabel(tons: number | null | undefined): string {
  const value = Number(tons);
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toLocaleString("en-IN")} MT`;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function CompliancePaymentConfirmModal({
  visible,
  summary,
  category,
  submitting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  summary: ComplianceTripSummary | null;
  category: ComplianceLedgerCategory | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (values: {
    amount: number;
    paymentModeId: string;
    paymentModeLabel: string;
    utr?: string;
    remark?: string;
  }) => void;
}) {
  const { height } = useWindowDimensions();
  const [amount, setAmount] = useState("");
  const [modeId, setModeId] = useState<string>("UPI");
  const [remark, setRemark] = useState("");
  const [truckType, setTruckType] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setModeId("UPI");
      setRemark("");
    }
  }, [visible, summary?.trip.id, category]);

  useEffect(() => {
    const trip = summary?.trip;
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
      if (!cancelled) setTruckType(shared.vehicle?.vehicle_type?.trim() || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, summary?.trip]);

  const parsedAmount = Number(amount);
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const mode = PAYMENT_MODES.find((item) => item.id === modeId);
  const canSubmit = amountOk && !!mode && !submitting && !!summary && !!category;
  const categoryLabel = category === "compliance_balance" ? "balance" : "advance";
  const trip = summary?.trip as PaymentTripFacts | undefined;
  const tripLabel = trip?.booking_ref ?? trip?.id.slice(0, 8) ?? "—";
  const confirmText = amountOk
    ? `Confirm ${categoryLabel} payment of ₹${parsedAmount.toLocaleString("en-IN")}`
    : `Confirm ${categoryLabel} payment`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        <View style={[styles.sheet, { maxHeight: Math.min(height - 32, 640) }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Confirm payment</Text>
            <Text style={styles.body}>
              You are about to post a {categoryLabel} payment through the Finance ledger. This cannot be undone
              from Compliance.
            </Text>

            <View style={styles.factCard}>
              <FactRow label="Vendor name" value={trip?.supplier_name?.trim() || "—"} />
              <FactRow label="Customer name" value={trip?.client_name?.trim() || "—"} />
              <FactRow label="Rate/MT" value={trip ? ratePerMtLabel(trip) : "—"} />
              <FactRow label="Loaded weight" value={loadedWeightLabel(trip?.load_tons)} />
              <FactRow label="Truck type" value={truckType?.trim() || "—"} />
              <FactRow label="Trip" value={tripLabel} />
              <FactRow label="Category" value={categoryLabel} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                editable={!submitting}
                placeholder="Enter amount"
                placeholderTextColor={Theme.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Payment mode</Text>
              <View style={styles.modeRow}>
                {PAYMENT_MODES.slice(0, 4).map((item) => {
                  const selected = modeId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setModeId(item.id)}
                      style={[styles.modeChip, selected && styles.modeChipOn]}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.modeChipText, selected && styles.modeChipTextOn]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={styles.remarkInput}
                value={remark}
                onChangeText={setRemark}
                editable={!submitting}
                placeholder="Add a remark"
                placeholderTextColor={Theme.textMuted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Remark"
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.rejectBtn}
                onPress={onCancel}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Reject"
              >
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
              <Pressable
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={confirmText}
                onPress={() => {
                  if (!mode || !canSubmit) return;
                  onConfirm({
                    amount: parsedAmount,
                    paymentModeId: mode.id,
                    paymentModeLabel: mode.name,
                    remark: remark.trim() || undefined,
                  });
                }}
              >
                {submitting ? (
                  <ActivityIndicator color={Theme.buttonDarkText} />
                ) : (
                  <Text style={styles.confirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
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
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: Theme.textPrimaryDark },
  body: { fontSize: 12, color: Theme.textMuted, lineHeight: 16 },
  factCard: {
    borderRadius: 10,
    backgroundColor: Theme.compliancePageBg,
    paddingVertical: 2,
    paddingHorizontal: 12,
  },
  factRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  factLabel: {
    width: 108,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  factValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    textAlign: "right",
  },
  field: { gap: 4 },
  label: { fontSize: 11, fontWeight: "600", color: Theme.textMuted },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    backgroundColor: Theme.cardWhite,
  },
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
  modeChipOn: { backgroundColor: Theme.buttonDark, borderColor: Theme.buttonDark },
  modeChipText: { fontSize: 11, fontWeight: "600", color: Theme.textMuted, textAlign: "center" },
  modeChipTextOn: { color: Theme.buttonDarkText },
  remarkInput: {
    height: 52,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
    color: Theme.textPrimaryDark,
    backgroundColor: Theme.cardWhite,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  rejectBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.negative,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { fontSize: 12, fontWeight: "600", color: Theme.negative },
  cancelBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 12, fontWeight: "600", color: Theme.textPrimaryDark },
  confirmBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: { fontSize: 12, fontWeight: "700", color: Theme.buttonDarkText, textAlign: "center" },
});
