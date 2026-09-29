import Theme from "@/constants/Theme";
import { Layout } from "@/constants/Layout";
import {
  canManageClientInvoicePodPolicy,
  getClientInvoicePodPolicy,
  updateClientInvoicePodPolicy,
} from "@/features/clients/services/clients.service";
import {
  INVOICE_POD_POLICIES,
  invoicePodPolicyLabel,
  parseInvoicePodPolicy,
  type InvoicePodPolicy,
} from "@/features/invoicing/utils/invoicePodPolicy.util";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const POLICY_OPTIONS: Array<{ value: InvoicePodPolicy; label: string }> =
  INVOICE_POD_POLICIES.map((value) => ({
    value,
    label: invoicePodPolicyLabel(value),
  }));

type Props = {
  orgId: string;
  clientId: string;
  /** Optional seed from an already-loaded client row/bundle. */
  rawPolicy?: unknown;
  /** Header-sized card placed beside the customer name. */
  compact?: boolean;
  /** Drop outer page margins so the card sits inside a dialog or form. */
  embedded?: boolean;
};

export function ClientInvoicePodPolicySection({
  orgId,
  clientId,
  rawPolicy,
  compact = false,
  embedded = false,
}: Props) {
  const queryClient = useQueryClient();
  const policyQueryKey = queryKeys.clients.invoicePodPolicy(orgId, clientId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const policyQ = useQuery({
    queryKey: policyQueryKey,
    queryFn: async () => {
      const { error, raw } = await getClientInvoicePodPolicy(orgId, clientId);
      if (error) throw error;
      return raw;
    },
    enabled: Boolean(orgId && clientId),
    staleTime: 60_000,
    initialData: rawPolicy,
  });

  const authQ = useQuery({
    queryKey: ["q", "clients", orgId, "invoice-pod-policy-auth"] as const,
    queryFn: async () => {
      const { error, allowed } = await canManageClientInvoicePodPolicy(orgId);
      if (error) throw error;
      return allowed;
    },
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });

  const canEdit = authQ.data === true;
  const parsed = parseInvoicePodPolicy(policyQ.data);
  const configuredPolicy = parsed.ok ? parsed.policy : null;

  const persist = async (next: InvoicePodPolicy | null) => {
    if (!canEdit || saving) return;
    setSaving(true);
    setSaveError(null);
    const { error, raw } = await updateClientInvoicePodPolicy(orgId, clientId, next);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    queryClient.setQueryData(policyQueryKey, raw ?? next);
    queryClient.invalidateQueries({
      queryKey: ["q", "invoicing", "client-pod-policies", orgId],
    });
    queryClient.setQueryData(
      queryKeys.clients.managementBundle(orgId, clientId),
      (prev: { client?: Record<string, unknown> | null } | undefined) => {
        if (!prev?.client) return prev;
        return {
          ...prev,
          client: { ...prev.client, invoice_pod_policy: raw ?? next },
        };
      },
    );
  };

  const statusLabel = !parsed.ok
    ? "Invalid policy"
    : configuredPolicy
      ? invoicePodPolicyLabel(configuredPolicy)
      : "Unconfigured";

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact, embedded && styles.wrapEmbedded]}
      accessibilityLabel="POD for Invoicing"
    >
      <View style={styles.head}>
        <Text style={[styles.kicker, compact && styles.kickerCompact]} numberOfLines={1}>
          POD for Invoicing
        </Text>
        <View
          style={[
            styles.statusBadge,
            !parsed.ok ? styles.statusBadgeBad : configuredPolicy ? styles.statusBadgeOk : styles.statusBadgeWarn,
          ]}
        >
          <Text
            style={[
              styles.status,
              !parsed.ok && styles.invalid,
              configuredPolicy ? styles.statusOk : !parsed.ok ? null : styles.statusWarn,
            ]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      {!parsed.ok ? (
        <Text style={styles.invalid} numberOfLines={1}>
          Reconfigure this policy before invoicing can use it.
        </Text>
      ) : null}

      <View
        style={[styles.optionsRow, compact && styles.optionsRowCompact]}
        accessibilityRole="radiogroup"
        accessibilityLabel="POD for invoicing policy"
      >
        {POLICY_OPTIONS.map((option) => {
          const selected = parsed.ok && configuredPolicy === option.value;
          return (
            <Pressable
              key={option.value}
              style={(state) => [
                styles.option,
                compact && styles.optionCompact,
                selected && styles.optionSelected,
                (state.pressed || Boolean((state as { hovered?: boolean }).hovered)) &&
                  !selected &&
                  styles.optionHover,
              ]}
              onPress={() => {
                void persist(option.value);
              }}
              disabled={!canEdit || saving}
              accessibilityRole="radio"
              accessibilityState={{
                selected,
                disabled: !canEdit || saving,
              }}
              accessibilityLabel={option.label}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text
                style={[styles.optionLabel, compact && styles.optionLabelCompact, !canEdit && styles.optionMuted]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {canEdit && parsed.ok && configuredPolicy ? (
          <Pressable
            style={styles.reset}
            onPress={() => {
              void persist(null);
            }}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Clear POD policy"
          >
            <Text style={styles.resetText} numberOfLines={1}>
              Clear policy
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!canEdit && authQ.isFetched ? (
        <Text style={styles.readonlyHint}>
          You can view this policy. Only finance administrators can change it.
        </Text>
      ) : null}

      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      {saving ? (
        <ActivityIndicator color={Theme.primary} style={styles.spinner} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    gap: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexShrink: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Theme.surfaceGray,
  },
  statusBadgeWarn: { backgroundColor: Theme.warningMuted },
  statusBadgeOk: { backgroundColor: Theme.positiveMuted },
  statusBadgeBad: { backgroundColor: Theme.modalNeutralIconWash },
  status: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimary,
  },
  statusWarn: { color: Theme.warning },
  statusOk: { color: Theme.positive },
  invalid: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.destructive,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
  },
  optionHover: {
    backgroundColor: Theme.surface,
    borderColor: Theme.borderFocus,
  },
  optionSelected: {
    backgroundColor: Theme.brandBlueWashSubtle,
    borderColor: Theme.analyticsHeroBg,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimary,
  },
  optionMuted: {
    color: Theme.textMuted,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Theme.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    borderColor: Theme.analyticsHeroBg,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.analyticsHeroBg,
  },
  reset: {
    flexShrink: 0,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.primary,
  },
  readonlyHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.destructive,
  },
  spinner: {
    marginTop: 8,
  },
  wrapEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  wrapCompact: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
    maxWidth: 460,
    flexShrink: 1,
  },
  kickerCompact: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  optionsRowCompact: { gap: 4 },
  optionCompact: {
    minHeight: 28,
    paddingVertical: 2,
    paddingHorizontal: 6,
    gap: 4,
    borderRadius: 8,
  },
  optionLabelCompact: { fontSize: 11 },
});
