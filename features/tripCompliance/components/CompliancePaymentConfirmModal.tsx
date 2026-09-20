import type { ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import type { ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import { PAYMENT_MODES } from "@/lib/paymentModes";
import Theme from "@/constants/Theme";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
  onConfirm: (values: { amount: number; paymentModeId: string; paymentModeLabel: string; utr?: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [modeId, setModeId] = useState<string>("UPI");
  const [utr, setUtr] = useState("");

  useEffect(() => {
    if (visible) {
      setAmount("");
      setModeId("UPI");
      setUtr("");
    }
  }, [visible, summary?.trip.id, category]);

  const parsedAmount = Number(amount);
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const needsUtr = modeId !== "CASH";
  const utrOk = !needsUtr || Boolean(utr.trim());
  const mode = PAYMENT_MODES.find((m) => m.id === modeId);
  const canSubmit = amountOk && utrOk && !!mode && !submitting && !!summary && !!category;
  const categoryLabel = category === "compliance_balance" ? "balance" : "advance";
  const tripLabel = summary?.trip.booking_ref ?? summary?.trip.id.slice(0, 8) ?? "—";
  const party = summary?.trip.client_name?.trim() || "Client";
  const confirmText = amountOk
    ? `Confirm ${categoryLabel} payment of ₹${parsedAmount.toLocaleString("en-IN")} for trip ${tripLabel}`
    : `Confirm ${categoryLabel} payment`;

  const readinessNote = useMemo(() => {
    if (!summary) return "";
    if (summary.complianceVerifiedAt) return "Compliance verification is complete.";
    return "Compliance verification is not complete.";
  }, [summary]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm payment</Text>
          <Text style={styles.body}>
            You are about to post a {categoryLabel} payment through the Finance ledger. This cannot be undone from
            Compliance.
          </Text>
          <Text style={styles.meta}>Trip: {tripLabel}</Text>
          <Text style={styles.meta}>Recipient: {party}</Text>
          <Text style={styles.meta}>Category: {categoryLabel}</Text>
          <Text style={styles.meta}>
            Advance: {summary?.advance ? `₹${summary.advance.amount.toLocaleString("en-IN")}` : "Not posted"}
          </Text>
          <Text style={styles.meta}>
            Balance: {summary?.balance ? `₹${summary.balance.amount.toLocaleString("en-IN")}` : "Not posted"}
          </Text>
          <Text style={styles.meta}>{readinessNote}</Text>

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            editable={!submitting}
          />
          <Text style={styles.label}>Payment mode</Text>
          <View style={styles.modeRow}>
            {PAYMENT_MODES.slice(0, 4).map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setModeId(m.id)}
                style={[styles.modeChip, modeId === m.id && styles.modeChipOn]}
                disabled={submitting}
              >
                <Text style={[styles.modeChipText, modeId === m.id && styles.modeChipTextOn]}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
          {needsUtr ? (
            <>
              <Text style={styles.label}>UTR / reference</Text>
              <TextInput style={styles.input} value={utr} onChangeText={setUtr} editable={!submitting} />
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
              disabled={!canSubmit}
              onPress={() => {
                if (!mode || !canSubmit) return;
                onConfirm({
                  amount: parsedAmount,
                  paymentModeId: mode.id,
                  paymentModeLabel: mode.name,
                  utr: utr.trim() || undefined,
                });
              }}
            >
              {submitting ? (
                <ActivityIndicator color={Theme.buttonDarkText} />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: Theme.cardWhite,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "800", color: Theme.textPrimary },
  body: { fontSize: 13, color: Theme.textMuted, lineHeight: 18 },
  meta: { fontSize: 13, color: Theme.textPrimary, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "700", color: Theme.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Theme.textPrimary,
  },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  modeChipOn: { backgroundColor: Theme.buttonDark, borderColor: Theme.buttonDark },
  modeChipText: { fontSize: 12, fontWeight: "700", color: Theme.textMuted },
  modeChipTextOn: { color: Theme.buttonDarkText },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
  cancelBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  cancelText: { fontSize: 13, fontWeight: "600", color: Theme.textMuted },
  confirmBtn: {
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Theme.buttonDark,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 12, fontWeight: "700", color: Theme.buttonDarkText, textAlign: "center" },
});
