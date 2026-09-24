import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SmartInput } from "@/components/mobile-input/SmartInput";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useDriverThemeColors } from "@/contexts/DriverThemeContext";
import {
  GENERAL_EXPENSE_CATEGORY_OPTIONS,
  buildGeneralExpenseWhatsAppMessage,
  saveDriverGeneralExpense,
  type DriverGeneralExpenseCategory,
} from "@/features/driver/services/driverGeneralExpense.util";

async function openWhatsApp(message: string) {
  const encoded = encodeURIComponent(message);
  const waWeb = `https://wa.me/?text=${encoded}`;
  const waNative = `whatsapp://send?text=${encoded}`;
  try {
    if (Platform.OS !== "web") {
      const can = await Linking.canOpenURL(waNative);
      await Linking.openURL(can ? waNative : waWeb);
    } else {
      await Linking.openURL(waWeb);
    }
  } catch {
    // ignore
  }
}

/**
 * General (no active trip) expense — device-local note + optional WhatsApp share.
 */
export function DriverGeneralExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useDriverThemeColors();
  const { profile } = useAuth();

  const [category, setCategory] = useState<DriverGeneralExpenseCategory>("misc");
  const [amountInr, setAmountInr] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = amountInr > 0 && !saving;

  const onSave = useCallback(
    async (share: boolean) => {
      if (!canSave) return;
      setSaving(true);
      try {
        const { error, entry } = await saveDriverGeneralExpense({
          category,
          amountInr,
          note,
        });
        if (error || !entry) {
          Alert.alert("Could not save", error?.message ?? "Unknown error");
          return;
        }
        if (share) {
          await openWhatsApp(
            buildGeneralExpenseWhatsAppMessage({
              entry,
              driverName: profile?.full_name ?? null,
              fleetName: "Fleet",
            }),
          );
        }
        Alert.alert(
          "Expense saved",
          share
            ? "Saved on this device and opened WhatsApp to share with fleet."
            : "Saved on this device. You can share it with fleet anytime.",
          [{ text: "Done", onPress: () => router.back() }],
        );
      } finally {
        setSaving(false);
      }
    },
    [amountInr, canSave, category, note, profile?.full_name, router],
  );

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backHit}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backText, { color: colors.emerald }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          General expense
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.kicker, { color: colors.textMuted }]}>
          Offline note for fleet
        </Text>

        <View>
          <Text style={[styles.label, { color: colors.textMuted }]}>Category</Text>
          <View style={styles.chipRow}>
            {GENERAL_EXPENSE_CATEGORY_OPTIONS.map((opt) => {
              const active = opt.value === category;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setCategory(opt.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? `${colors.emerald}18`
                        : colors.surface,
                      borderColor: active ? colors.emerald : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.emerald : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={[styles.label, { color: colors.textMuted }]}>Amount</Text>
          <SmartInput
            type="currency"
            value={amountInr}
            onChange={(_, numeric) => setAmountInr(numeric)}
            label="Expense amount"
            submitLabel="Apply"
            variant="field"
            density="compact"
            placeholder="Enter amount"
          />
        </View>

        <View>
          <Text style={[styles.label, { color: colors.textMuted }]}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional details"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[
              styles.note,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          />
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Saved on this phone only. Share with fleet owner over WhatsApp to settle
          offline — not synced as a trip reimbursement.
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          disabled={!canSave}
          onPress={() => void onSave(false)}
          style={[
            styles.secondaryBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: canSave ? 1 : 0.5,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.emerald} />
          ) : (
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              Save only
            </Text>
          )}
        </Pressable>
        <Pressable
          disabled={!canSave}
          onPress={() => void onSave(true)}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: colors.emerald,
              opacity: canSave ? 1 : 0.5,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={Theme.textOnPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Save & share</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 44,
    marginBottom: 8,
  },
  backHit: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  backText: { fontSize: 15, fontWeight: "600" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  headerSpacer: { minWidth: 64 },
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  note: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700" },
  primaryBtn: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textOnPrimary,
  },
});
