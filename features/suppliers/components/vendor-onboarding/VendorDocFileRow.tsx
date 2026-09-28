/**
 * One document line inside a vault form card — same look as the profile card's
 * registry rows (hairline dividers, small uppercase status pill), actions use
 * the shared PulsePillButton.
 */
import { StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PulsePillButton } from "@/components/PulsePillButton";
import Theme from "@/constants/Theme";
import type { SupplierKycDocument } from "@/features/suppliers/types/supplierManagement.types";
import { formatTripTableDate } from "@/lib/format";

type Props = {
  title: string;
  doc: SupplierKycDocument | undefined;
  canEdit: boolean;
  busy: boolean;
  /** single sections replace the file; multi sections remove it. */
  kind: "single" | "multi";
  last?: boolean;
  onUpload?: () => void;
  onView: (doc: SupplierKycDocument) => void;
  onVerify: (doc: SupplierKycDocument) => void;
  onRemove?: (doc: SupplierKycDocument) => void;
};

export function VendorDocFileRow({
  title,
  doc,
  canEdit,
  busy,
  kind,
  last,
  onUpload,
  onView,
  onVerify,
  onRemove,
}: Props) {
  const hasFile = Boolean((doc?.storage_path ?? "").trim());
  const verified = hasFile && doc?.status === "verified";
  const when = doc?.updated_at || doc?.created_at;
  const status = !hasFile ? "Missing" : verified ? "Verified" : "Pending";
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={[styles.icon, verified && styles.iconOk]}>
        <FontAwesome
          name={hasFile ? "file-text-o" : "cloud-upload"}
          size={13}
          color={verified ? Theme.positive : Theme.textMuted}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.pill, verified ? styles.pillOk : hasFile ? styles.pillPending : styles.pillMissing]}>
            <Text
              style={[
                styles.pillText,
                verified ? styles.pillTextOk : hasFile ? styles.pillTextPending : styles.pillTextMissing,
              ]}
            >
              {status}
            </Text>
          </View>
          <Text style={styles.metaText} numberOfLines={1}>
            {hasFile ? `${doc?.file_name ?? "File"} · ${when ? formatTripTableDate(when) : "—"}` : "No file uploaded"}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {busy ? (
          <LoadingIndicator size="small" color={Theme.textPrimaryDark} />
        ) : (
          <>
            {hasFile && doc ? (
              <PulsePillButton
                label="View"
                size="compact"
                variant="outline"
                onPress={() => onView(doc)}
                accessibilityLabel={`View ${title}`}
              />
            ) : null}
            {canEdit && hasFile && doc && !verified ? (
              <PulsePillButton
                label="Verify"
                size="compact"
                variant="outline"
                onPress={() => onVerify(doc)}
                accessibilityLabel={`Verify ${title}`}
              />
            ) : null}
            {canEdit && kind === "single" && onUpload ? (
              <PulsePillButton
                label={hasFile ? "Replace" : "Upload"}
                size="compact"
                variant="dark"
                onPress={onUpload}
                accessibilityLabel={`${hasFile ? "Replace" : "Upload"} ${title}`}
              />
            ) : null}
            {canEdit && kind === "multi" && doc && onRemove ? (
              <PulsePillButton
                label="Remove"
                size="compact"
                variant="outline"
                onPress={() => onRemove(doc)}
                accessibilityLabel={`Remove ${title}`}
                labelStyle={styles.removeText}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderInput,
    flexWrap: "wrap",
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Theme.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOk: { backgroundColor: Theme.positiveMuted },
  body: { flex: 1, minWidth: 150 },
  title: { fontSize: 12, fontWeight: "700", color: Theme.textPrimaryDark, marginBottom: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 10, fontWeight: "500", color: Theme.textMuted, flexShrink: 1 },
  pill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  pillOk: { backgroundColor: Theme.positiveMuted },
  pillPending: { backgroundColor: Theme.warningMuted },
  pillMissing: { backgroundColor: Theme.surfaceGray },
  pillText: { fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  pillTextOk: { color: Theme.positive },
  pillTextPending: { color: Theme.warning },
  pillTextMissing: { color: Theme.textMuted },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: "auto" },
  removeText: { color: Theme.negative },
});
