/**
 * In-app Compliance document preview — same shape as the driver POD lightbox.
 * Signs nothing itself; the caller passes a URL already resolved from the
 * stored object path (one Storage sign, no extra bucket probes).
 */
import Theme from "@/constants/Theme";
import { PdfViewer } from "@/components/PdfViewer";
import type { StopProofDocumentSummary } from "@/features/driver/job-card/deliveryProof";
import { X } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export function ComplianceDocumentPreviewModal({
  visible,
  title,
  url,
  mime,
  loading,
  placeProof,
  onClose,
}: {
  visible: boolean;
  title: string;
  url: string | null;
  mime: string | null;
  loading: boolean;
  placeProof: StopProofDocumentSummary | null;
  onClose: () => void;
}) {
  const isPdf = (mime ?? "").includes("pdf");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.topBar}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <X size={18} color={Theme.textPrimary} strokeWidth={2.2} />
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          {placeProof ? (
            <View style={styles.placeBox}>
              <Text style={styles.placeLabel}>{placeProof.label}</Text>
              <Text style={styles.placeHint}>
                {placeProof.kind === "pickup"
                  ? "Pickup place was recorded without a photo."
                  : "Delivery place was recorded without a photo."}
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={Theme.textMuted} />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : url && isPdf ? (
            <View style={styles.pdfWrap}>
              <PdfViewer pdfUri={url} />
            </View>
          ) : url ? (
            <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={styles.missing}>No preview is available for this file.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    backgroundColor: Theme.cardWhite,
    borderRadius: 14,
    overflow: "hidden",
    padding: 12,
    gap: 10,
  },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 14, fontWeight: "700", color: Theme.textPrimary, minWidth: 0 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Theme.compliancePageBg,
  },
  closeText: { fontSize: 12, fontWeight: "700", color: Theme.textPrimary },
  body: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 12, color: Theme.textMuted },
  image: { width: "100%", height: 360, backgroundColor: Theme.compliancePageBg, borderRadius: 8 },
  pdfWrap: { width: "100%", height: 420, overflow: "hidden", borderRadius: 8 },
  placeBox: { paddingVertical: 28, paddingHorizontal: 12, alignItems: "center", gap: 8 },
  placeLabel: { fontSize: 18, fontWeight: "700", color: Theme.textPrimary, textAlign: "center" },
  placeHint: { fontSize: 13, color: Theme.textMuted, textAlign: "center", lineHeight: 18 },
  missing: { fontSize: 13, color: Theme.textMuted, textAlign: "center", paddingVertical: 32 },
});
