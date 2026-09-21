import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import {
  fetchTripHardCopyPodReceipt,
  markTripHardCopyPodReceived,
  tripPodIsReceived,
  type TripHardCopyPodReceipt,
} from "@/features/trips/services/tripDocumentLrPod.service";
import { TripCompletionOrPodTags } from "@/features/trips/components/TripPodStatusTags";
import { queryKeys } from "@/lib/queryKeys";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function formatReceivedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TripPodStatusSection({
  tripId,
  organizationId,
  podReceivedAt,
  softCopyReceived,
  tripCompleted,
  canMutate,
  onSoftCopyUpload,
  onUpdated,
}: {
  tripId: string;
  organizationId?: string | null;
  podReceivedAt?: string | null;
  softCopyReceived: boolean;
  tripCompleted: boolean;
  canMutate: boolean;
  onSoftCopyUpload?: () => void;
  onUpdated?: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [comment, setComment] = useState("");
  const [receipt, setReceipt] = useState<TripHardCopyPodReceipt | null>(null);
  const hardCopyReceived = tripPodIsReceived({ pod_received_at: podReceivedAt });
  const receivedLabel = formatReceivedAt(podReceivedAt);
  const canRecordHardCopy = canMutate && tripCompleted && !hardCopyReceived;

  useEffect(() => {
    if (!hardCopyReceived) {
      setReceipt(null);
      return;
    }
    let cancelled = false;
    void fetchTripHardCopyPodReceipt(tripId).then(({ receipt: r }) => {
      if (!cancelled) setReceipt(r);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId, hardCopyReceived, podReceivedAt]);

  const openConfirm = useCallback(() => {
    if (!canRecordHardCopy) return;
    setChecked(false);
    setComment("");
    setConfirming(true);
  }, [canRecordHardCopy]);

  const cancelConfirm = useCallback(() => {
    setConfirming(false);
    setChecked(false);
    setComment("");
  }, []);

  const markReceived = useCallback(async () => {
    if (!canRecordHardCopy || saving || !checked) return;
    setSaving(true);
    const { error, alreadyReceived } = await markTripHardCopyPodReceived(tripId, {
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Hard copy POD", error.message);
      return;
    }
    setConfirming(false);
    setChecked(false);
    setComment("");
    if (alreadyReceived) {
      Alert.alert("Hard copy POD", "This trip's hard-copy POD was already recorded as received.");
    }
    void queryClient.invalidateQueries({ queryKey: ["q", "trips"] });
    if (organizationId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.logPods.trips(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoicing.trips(organizationId) });
    }
    onUpdated?.();
  }, [
    canRecordHardCopy,
    checked,
    comment,
    organizationId,
    onUpdated,
    queryClient,
    saving,
    tripId,
  ]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>POD status</Text>
        <TripCompletionOrPodTags
          tripCompleted={tripCompleted}
          softCopyReceived={softCopyReceived}
          hardCopyReceived={hardCopyReceived}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Soft copy</Text>
          <Text style={styles.value}>
            {softCopyReceived ? "Received" : "Pending"}
          </Text>
          {!softCopyReceived && canMutate && tripCompleted && onSoftCopyUpload ? (
            <Pressable
              onPress={onSoftCopyUpload}
              style={styles.linkBtn}
              accessibilityRole="button"
              accessibilityLabel="Upload soft copy POD"
            >
              <Text style={styles.linkText}>Upload digital POD</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Hard copy</Text>
          <Text style={styles.value}>
            {hardCopyReceived ? "Received" : "Pending"}
          </Text>
          {hardCopyReceived && receivedLabel ? (
            <Text style={styles.meta}>{receivedLabel}</Text>
          ) : null}
          {!tripCompleted && !hardCopyReceived ? (
            <Text style={styles.meta}>Available after the trip is delivered</Text>
          ) : null}
        </View>
      </View>

      {confirming ? (
        <View style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>Mark Hard Copy POD Received</Text>
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setChecked((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <FontAwesome name="check" size={10} color={Theme.buttonPrimaryText} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>Physical POD has been received and checked</Text>
          </Pressable>
          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a note about this receipt"
            multiline
            numberOfLines={3}
          />
          <View style={styles.confirmActionsRow}>
            <Pressable style={styles.secondaryBtn} onPress={cancelConfirm} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, styles.confirmConfirmBtn, (!checked || saving) && styles.primaryBtnDisabled]}
              onPress={() => void markReceived()}
              disabled={!checked || saving}
              accessibilityRole="button"
              accessibilityLabel="Confirm hard copy POD receipt"
            >
              {saving ? (
                <ActivityIndicator size="small" color={Theme.buttonPrimaryText} />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm Receipt</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : canRecordHardCopy ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={openConfirm}
          accessibilityRole="button"
          accessibilityLabel="Mark hard copy POD received"
        >
          <FontAwesome name="check" size={12} color={Theme.buttonPrimaryText} />
          <Text style={styles.primaryBtnText}>Mark Hard Copy POD Received</Text>
        </Pressable>
      ) : hardCopyReceived ? (
        <View>
          <View style={styles.receivedBar}>
            <FontAwesome name="check-circle" size={13} color={Theme.positive} />
            <Text style={styles.receivedBarText}>Already received</Text>
          </View>
          {receipt?.receivedBy ? <Text style={styles.meta}>Received by: {receipt.receivedBy}</Text> : null}
          {receipt?.comment ? <Text style={styles.meta}>Comment: {receipt.comment}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderMedium,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  confirmPanel: {
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Theme.compliancePageBg,
  },
  confirmTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Theme.borderMedium,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Theme.buttonPrimary,
    borderColor: Theme.buttonPrimary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: Theme.textPrimaryDark,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Theme.textPrimaryDark,
    minHeight: 64,
    textAlignVertical: "top",
    backgroundColor: Theme.cardWhite,
  },
  confirmActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: Layout.minTouchTargetSize,
    borderRadius: Theme.buttonPrimaryRadius,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.borderMedium,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  confirmConfirmBtn: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.12,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  value: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    color: Theme.textRouteCard,
  },
  linkBtn: {
    marginTop: 6,
    minHeight: Layout.minTouchTargetSize,
    justifyContent: "center",
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.primary,
  },
  primaryBtn: {
    minHeight: Layout.minTouchTargetSize,
    borderRadius: Theme.buttonPrimaryRadius,
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.buttonPrimaryText,
  },
  receivedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
  },
  receivedBarText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.positive,
  },
});
