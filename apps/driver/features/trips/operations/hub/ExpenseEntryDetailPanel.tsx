import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Theme from "@pulse/core/constants/Theme";
import type { TripCostEvent } from "@pulse/domain/features/finance/domain/tripCostEvent";
import { getDocumentViewUrl } from "@pulse/domain/features/trips/services/tripDocuments.service";
import {
  loadExpensePreviewDetail,
  type ExpensePreviewDetail,
} from "@pulse/domain/features/trips/operations/shared/expensePreview.util";

type Props = {
  event: TripCostEvent;
  statusLabel: string;
  inline?: boolean;
  loadingAction?: boolean;
  onEdit?: (event: TripCostEvent) => void;
  onRemind?: (event: TripCostEvent) => void;
  onCancel?: (event: TripCostEvent) => void;
};

function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function ExpenseEntryDetailPanel({
  event,
  statusLabel,
  inline = false,
  loadingAction = false,
  onEdit,
  onRemind,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExpensePreviewDetail | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptFullscreen, setReceiptFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setReceiptUrl(null);
    void loadExpensePreviewDetail(event.id, event).then((res) => {
      if (!mounted) return;
      setLoading(false);
      if (res.error || !res.detail) {
        setError(res.error?.message ?? "Could not load expense");
        setDetail(null);
        return;
      }
      setDetail(res.detail);
      const path = res.detail.receiptStoragePath?.trim();
      if (!path) return;
      setReceiptLoading(true);
      void getDocumentViewUrl(path).then((url) => {
        if (!mounted) return;
        setReceiptUrl(url || null);
        setReceiptLoading(false);
      });
    });
    return () => {
      mounted = false;
    };
  }, [event]);

  const showDriverActions =
    event.approvalState === "pending" && event.postingState !== "posted";

  const displayAmount = detail?.amountInr ?? event.amount;
  const enteredAt = detail?.enteredAt ?? event.createdAt;

  const content = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={Theme.driverEmeraldDark} size="small" />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  ) : error ? (
    <View style={styles.center}>
      <Feather name="alert-circle" size={18} color={Theme.destructive} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : detail ? (
    <>
      {!inline ? (
        <View style={styles.hero}>
          <Text style={styles.category}>{detail.categoryLabel}</Text>
          <Text style={styles.amount}>{inr(displayAmount)}</Text>
          <Text style={styles.date}>
            {new Date(enteredAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      ) : (
        <Text style={styles.inlineTime}>
          {new Date(enteredAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}

      <View style={[styles.metaGrid, inline && styles.metaGridInline]}>
        {detail.detailLines.map((line) => (
          <View key={line.label} style={styles.metaCell}>
            <Text style={styles.metaLabel}>{line.label}</Text>
            <Text style={styles.metaValue} numberOfLines={2}>
              {line.value}
            </Text>
          </View>
        ))}
      </View>

      {detail.notes ? (
        <View style={styles.notesBlock}>
          <Text style={styles.metaLabel}>Notes</Text>
          <Text style={styles.notesText}>{detail.notes}</Text>
        </View>
      ) : null}

      <View style={styles.receiptBlock}>
        <Text style={styles.metaLabel}>Receipt</Text>
        {receiptLoading ? (
          <ActivityIndicator color={Theme.driverEmeraldDark} size="small" style={styles.receiptLoader} />
        ) : receiptUrl ? (
          <Pressable
            onPress={() => setReceiptFullscreen(true)}
            accessibilityRole="button"
            accessibilityLabel="View receipt full screen"
          >
            <Image
              source={{ uri: receiptUrl }}
              style={[styles.receiptImage, inline && styles.receiptImageInline]}
              resizeMode="cover"
            />
            <Text style={styles.receiptHint}>Tap to enlarge</Text>
          </Pressable>
        ) : detail.receiptStoragePath ? (
          <Text style={styles.receiptMissing}>Uploaded — preview unavailable</Text>
        ) : (
          <Text style={styles.receiptMissing}>No receipt attached</Text>
        )}
      </View>

      {(detail.canEdit && onEdit) || showDriverActions ? (
        <View style={styles.actionsWrap}>
          {detail.canEdit && onEdit ? (
            <Pressable
              style={[styles.editBtn, inline && styles.editBtnInline]}
              onPress={() => onEdit(event)}
              disabled={loadingAction}
            >
              <Feather name="edit-2" size={13} color={Theme.driverEmeraldDark} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          ) : null}

          {showDriverActions ? (
            <View style={styles.driverActions}>
              <Pressable
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => onRemind?.(event)}
                disabled={loadingAction}
              >
                <Text style={styles.actionPrimaryText}>Remind fleet</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onCancel?.(event)}
                disabled={loadingAction}
              >
                <Text style={styles.actionSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  ) : null;

  return (
    <>
      <View style={[styles.panel, inline && styles.panelInline]}>
        {!inline ? (
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Entry detail</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
          </View>
        ) : null}
        {content}
      </View>

      <Modal
        visible={receiptFullscreen && !!receiptUrl}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiptFullscreen(false)}
      >
        <Pressable style={styles.fullscreenBackdrop} onPress={() => setReceiptFullscreen(false)}>
          {receiptUrl ? (
            <Image source={{ uri: receiptUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
    padding: 14,
    gap: 10,
  },
  panelInline: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 12,
    gap: 8,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: "rgba(4,120,87,0.10)",
    borderWidth: 1,
    borderColor: "rgba(4,120,87,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.driverEmeraldDark,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 11,
    color: Theme.textSecondary,
  },
  errorText: {
    fontSize: 11,
    color: Theme.destructive,
    textAlign: "center",
  },
  hero: {
    alignItems: "flex-start",
    gap: 3,
  },
  category: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  amount: {
    fontSize: 22,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.4,
  },
  date: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textSecondary,
  },
  inlineTime: {
    fontSize: 11,
    fontWeight: "500",
    color: Theme.textSecondary,
    paddingTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderRadius: 10,
    backgroundColor: Theme.screenBackground,
    padding: 10,
  },
  metaGridInline: {
    backgroundColor: "rgba(4,120,87,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(4,120,87,0.12)",
  },
  metaCell: {
    width: "47%",
    gap: 2,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Theme.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  notesBlock: {
    gap: 3,
    paddingHorizontal: 2,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 17,
    color: Theme.textSecondary,
  },
  receiptBlock: {
    gap: 6,
    paddingHorizontal: 2,
  },
  receiptLoader: {
    alignSelf: "flex-start",
  },
  receiptImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    backgroundColor: Theme.borderLight,
  },
  receiptImageInline: {
    height: 120,
  },
  receiptHint: {
    marginTop: 4,
    fontSize: 10,
    color: Theme.driverEmeraldDark,
    fontWeight: "600",
  },
  receiptMissing: {
    fontSize: 11,
    color: Theme.textMuted,
  },
  actionsWrap: {
    gap: 8,
    paddingTop: 2,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(4,120,87,0.25)",
    backgroundColor: "rgba(4,120,87,0.06)",
  },
  editBtnInline: {
    paddingVertical: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.driverEmeraldDark,
  },
  driverActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  actionPrimary: {
    backgroundColor: Theme.driverEmeraldDark,
    borderColor: Theme.driverEmeraldDark,
  },
  actionPrimaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  actionSecondaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textSecondary,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
