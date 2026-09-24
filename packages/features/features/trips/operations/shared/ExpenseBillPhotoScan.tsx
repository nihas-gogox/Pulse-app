import Feather from "@expo/vector-icons/Feather";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import Theme from "@pulse/core/constants/Theme";

import type { BillPendingFieldUpdate, BillScanState } from "@pulse/domain/features/trips/operations/shared/expenseBillScan.types";

type Props = {
  label: string;
  uri?: string | null;
  scan: BillScanState;
  scanning?: boolean;
  busy?: boolean;
  onAttach: () => void;
  onPressPreview?: () => void;
  onRetake?: () => void;
  onRemove?: () => void;
  onRescanPhoto?: () => void;
  onApplyPending?: () => void;
  onDismissPending?: () => void;
  onReviewOcr?: () => void;
};

function FieldUpdateRow({ item, applied }: { item: BillPendingFieldUpdate; applied?: boolean }) {
  const hasFrom = Boolean(item.fromDisplay?.trim() && item.fromDisplay !== "—");
  return (
    <View style={styles.updateRow}>
      <Text style={styles.updateLabel} numberOfLines={1}>
        {item.label}
      </Text>
      <View style={styles.updateValues}>
        {hasFrom ? (
          <>
            <Text style={styles.updateFrom} numberOfLines={1}>
              {item.fromDisplay}
            </Text>
            <Feather name="arrow-right" size={9} color={Theme.textMuted} />
          </>
        ) : null}
        <Text
          style={[styles.updateTo, applied && styles.updateToApplied]}
          numberOfLines={1}
        >
          {item.toDisplay}
        </Text>
      </View>
    </View>
  );
}

export function ExpenseBillPhotoScan({
  label,
  uri,
  scan,
  scanning = false,
  busy = false,
  onAttach,
  onPressPreview,
  onRetake,
  onRemove,
  onRescanPhoto,
  onApplyPending,
  onDismissPending,
  onReviewOcr,
}: Props) {
  const hasPhoto = Boolean(uri?.trim());
  const isAnalyzing = scanning || scan.phase === "preparing" || scan.phase === "analyzing";
  const isConfirm = scan.phase === "confirm";
  const isComplete = scan.phase === "complete";
  const isError = scan.phase === "error";
  const pendingUpdates = scan.pendingUpdates ?? [];
  const appliedUpdates = scan.appliedOcrUpdates ?? [];
  const hasPendingApply = pendingUpdates.length > 0 && isConfirm;
  const showAppliedUpdates = isComplete && appliedUpdates.length > 0;
  const displayUpdates = hasPendingApply ? pendingUpdates : showAppliedUpdates ? appliedUpdates : [];
  const fieldCount = pendingUpdates.length || appliedUpdates.length || scan.appliedFields.length;

  const accent = isError ? Theme.warning : hasPendingApply ? Theme.primary : Theme.driverEmeraldDark;

  const statusTitle = isAnalyzing
    ? "Reading…"
    : hasPendingApply
      ? `${pendingUpdates.length} field${pendingUpdates.length === 1 ? "" : "s"} to apply`
      : showAppliedUpdates
        ? `${appliedUpdates.length} applied from OCR`
        : isComplete && fieldCount > 0
          ? "Scan complete"
          : isError
            ? "Scan failed"
            : hasPhoto
              ? "Photo ready"
              : "Add receipt";

  const statusHint = isAnalyzing
    ? scan.message
    : hasPendingApply
      ? "Confirm to fill form · skip to keep current values"
      : showAppliedUpdates
        ? "Tap review to re-open field diff"
        : isComplete
          ? scan.message || "No new fields detected"
          : isError
            ? scan.message
            : hasPhoto
              ? "Tap re-scan to extract fields"
              : "Camera or gallery";

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {hasPhoto ? (
          <Pressable
            style={[styles.thumb, isAnalyzing && styles.thumbScanning]}
            onPress={onPressPreview}
            disabled={!onPressPreview || busy}
            accessibilityRole={onPressPreview ? "button" : "image"}
            accessibilityLabel={`${label} photo`}
          >
            <Image source={{ uri: uri! }} style={styles.thumbImage} resizeMode="cover" />
            {isAnalyzing ? (
              <View style={styles.thumbOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            style={styles.thumbEmpty}
            onPress={onAttach}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Attach ${label}`}
          >
            {busy ? (
              <ActivityIndicator color={Theme.driverEmeraldDark} size="small" />
            ) : (
              <Feather name="camera" size={22} color={Theme.driverEmeraldDark} />
            )}
          </Pressable>
        )}

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {scan.processingSec != null && scan.processingSec > 0 && !isAnalyzing ? (
              <Text style={styles.timing}>{scan.processingSec.toFixed(1)}s</Text>
            ) : null}
          </View>
          <Text style={styles.statusTitle} numberOfLines={1}>
            {statusTitle}
          </Text>
          <Text style={styles.statusHint} numberOfLines={2}>
            {statusHint}
          </Text>
        </View>

        <View style={styles.actions}>
          {hasPendingApply ? (
            <>
              <Pressable
                style={[styles.iconBtn, styles.iconBtnPrimary, { backgroundColor: accent }]}
                onPress={() => onApplyPending?.()}
                accessibilityRole="button"
                accessibilityLabel="Apply OCR fields"
              >
                <Feather name="check" size={14} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                onPress={() => onDismissPending?.()}
                accessibilityRole="button"
                accessibilityLabel="Keep current values"
              >
                <Feather name="x" size={14} color={Theme.textMuted} />
              </Pressable>
            </>
          ) : null}

          {!hasPendingApply && hasPhoto && onRescanPhoto ? (
            <Pressable
              style={styles.iconBtn}
              onPress={() => onRescanPhoto()}
              disabled={busy || isAnalyzing}
              accessibilityRole="button"
              accessibilityLabel="Re-scan receipt"
            >
              <Feather name="refresh-cw" size={14} color={accent} />
            </Pressable>
          ) : null}

          {!hasPendingApply && (showAppliedUpdates || (isComplete && fieldCount > 0)) && onReviewOcr ? (
            <Pressable
              style={styles.iconBtn}
              onPress={() => onReviewOcr()}
              accessibilityRole="button"
              accessibilityLabel="Review OCR fields"
            >
              <Feather name="edit-3" size={14} color={accent} />
            </Pressable>
          ) : null}

          {hasPhoto && onRetake ? (
            <Pressable
              style={styles.iconBtn}
              onPress={() => onRetake()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
            >
              <Feather name="camera" size={14} color={Theme.textSecondary} />
            </Pressable>
          ) : null}

          {hasPhoto && onRemove ? (
            <Pressable
              style={[styles.iconBtn, styles.iconBtnDanger]}
              onPress={() => onRemove()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Feather name="trash-2" size={13} color={Theme.destructive} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {displayUpdates.length > 0 ? (
        <View style={styles.updates}>
          {displayUpdates.slice(0, 5).map((item) => (
            <FieldUpdateRow key={item.id} item={item} applied={showAppliedUpdates} />
          ))}
          {displayUpdates.length > 5 ? (
            <Text style={styles.updatesMore}>+{displayUpdates.length - 5} more</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignSelf: "stretch",
    gap: 8,
    marginBottom: 4,
  },
  card: {
    width: "100%",
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  thumb: {
    width: 76,
    height: 58,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.surface,
    flexShrink: 0,
  },
  thumbScanning: {
    borderColor: "#6ee7b7",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmpty: {
    width: 76,
    height: 58,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(4,120,87,0.28)",
    backgroundColor: Theme.driverEmeraldMuted,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  timing: {
    fontSize: 9,
    fontWeight: "700",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Theme.driverEmeraldDark,
    letterSpacing: 0.15,
    textTransform: "uppercase",
  },
  statusHint: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textSecondary,
    lineHeight: 14,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPrimary: {
    borderWidth: 0,
  },
  iconBtnDanger: {
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: "rgba(254,226,226,0.45)",
  },
  updates: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
    gap: 6,
  },
  updateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 20,
  },
  updateLabel: {
    width: 80,
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  updateValues: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  updateFrom: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
    fontVariant: ["tabular-nums"],
    maxWidth: "38%",
  },
  updateTo: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  updateToApplied: {
    color: Theme.driverEmeraldDark,
  },
  updatesMore: {
    fontSize: 9,
    fontWeight: "600",
    color: Theme.textMuted,
    textAlign: "center",
    paddingTop: 2,
  },
});
