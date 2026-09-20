/**
 * The Compliance operational layer over trip_documents — Document / Required /
 * Status / Uploaded / Verified / Action. This is presentation only: it reads
 * the same `ComplianceDocumentRow[]` the rest of the feature already fetches
 * and calls the same verify/reject/upload service functions Trip Detail's
 * Asset Vault already uses. No new table, no new persistence model.
 *
 * Synthesizes a "missing" row for any Compliance-required document type with
 * no uploaded row at all — Asset Vault's own document list only ever shows
 * documents that exist, so "Insurance is missing" was previously invisible
 * anywhere in the UI.
 */
import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Theme from "@/constants/Theme";
import { uploadTripDocument, type TripDocumentType } from "@/features/trips/services/tripDocuments.service";
import {
  COMPLIANCE_TRIP_DOC_PICKER_TYPES,
  validateComplianceTripDocumentFile,
} from "@/features/tripCompliance/utils/complianceTripDocumentFormat.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";
import {
  deriveComplianceDocumentRows,
  labelForDocType,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import { COMPLIANCE_STATUS_META } from "@/features/tripCompliance/components/ComplianceStatusIcon";

type TableRow = ComplianceDocRow;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

export type ComplianceDocumentTableProps = {
  tripId: string;
  organizationId: string;
  actorId: string | null;
  documents: ComplianceDocumentRow[];
  canVerify: boolean;
  onPreview: (doc: ComplianceDocumentRow) => void;
  onVerify: (doc: ComplianceDocumentRow) => void;
  onReject: (doc: ComplianceDocumentRow) => void;
  busyDocId: string | null;
  /** Called after a missing document is successfully uploaded, to refetch. */
  onUploaded: () => void;
};

export function ComplianceDocumentTable({
  tripId,
  organizationId: _organizationId,
  actorId,
  documents,
  canVerify,
  onPreview,
  onVerify,
  onReject,
  busyDocId,
  onUploaded,
}: ComplianceDocumentTableProps) {
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const rows: TableRow[] = deriveComplianceDocumentRows(documents);

  const handleAddMissing = useCallback(
    async (type: string) => {
      if (!actorId) return;
      setUploadingType(type);
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: [...COMPLIANCE_TRIP_DOC_PICKER_TYPES],
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets[0]) return;
        const asset = res.assets[0];
        const fileName = asset.name ?? `${type}.pdf`;
        if (typeof asset.size === "number") {
          const early = validateComplianceTripDocumentFile({
            fileName,
            mimeType: asset.mimeType,
            byteLength: asset.size,
          });
          if (!early.ok) throw new Error(early.reason);
        }
        const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
        const format = validateComplianceTripDocumentFile({
          fileName,
          mimeType: asset.mimeType,
          byteLength: arrayBuffer.byteLength,
        });
        if (!format.ok) throw new Error(format.reason);
        const { error } = await uploadTripDocument(
          tripId,
          actorId,
          { arrayBuffer, fileName, mimeType: format.mimeType },
          type as TripDocumentType,
          undefined,
          { replaceExistingOfType: true },
        );
        if (error) throw error;
        onUploaded();
      } catch (e) {
        alertMessage("Couldn't add document", (e as Error).message);
      } finally {
        setUploadingType(null);
      }
    },
    [tripId, actorId, onUploaded],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.colDoc, styles.headerText]}>Document</Text>
        <Text style={[styles.cell, styles.colRequired, styles.headerText]}>Required</Text>
        <Text style={[styles.cell, styles.colStatus, styles.headerText]}>Status</Text>
        <Text style={[styles.cell, styles.colDate, styles.headerText]}>Uploaded</Text>
        <Text style={[styles.cell, styles.colDate, styles.headerText]}>Verified</Text>
        <Text style={[styles.cell, styles.colAction, styles.headerText]}>Action</Text>
      </View>

      {rows.map((row) => {
        const meta = COMPLIANCE_STATUS_META[row.status];
        const isBusy = (row.doc && busyDocId === row.doc.id) || uploadingType === row.type;
        return (
          <View key={row.key} style={styles.row}>
            <Text style={[styles.cell, styles.colDoc, styles.docLabel]} numberOfLines={1}>
              {labelForDocType(row.type)}
            </Text>
            <Text style={[styles.cell, styles.colRequired]}>{row.required ? "✓" : "—"}</Text>
            <View style={styles.colStatus}>
              <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.statusPillText, { color: meta.color }]}>
                  {meta.glyph} {meta.label.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.cell, styles.colDate, styles.muted]}>{formatDate(row.doc?.uploaded_at)}</Text>
            <Text style={[styles.cell, styles.colDate, styles.muted]} numberOfLines={2}>
              {row.doc?.verified_at ? formatDate(row.doc.verified_at) : "—"}
              {row.status === "rejected" && row.doc?.rejection_reason ? `\n${row.doc.rejection_reason}` : ""}
            </Text>
            <View style={[styles.colAction, styles.actionCell]}>
              {isBusy ? (
                <ActivityIndicator size="small" color={Theme.textMuted} />
              ) : row.status === "missing" ? (
                canVerify ? (
                  <TouchableOpacity onPress={() => handleAddMissing(row.type)}>
                    <Text style={styles.actionLink}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.muted}>—</Text>
                )
              ) : (
                <>
                  <TouchableOpacity onPress={() => onPreview(row.doc!)}>
                    <Text style={styles.actionLink}>Preview</Text>
                  </TouchableOpacity>
                  {canVerify && row.status !== "verified" ? (
                    <TouchableOpacity onPress={() => onVerify(row.doc!)}>
                      <Text style={styles.actionLink}> · Verify</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canVerify && row.status !== "rejected" ? (
                    <TouchableOpacity onPress={() => onReject(row.doc!)}>
                      <Text style={[styles.actionLink, styles.rejectLink]}> · Reject</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tableScroll: { flexGrow: 0 },
  table: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, overflow: "hidden", minWidth: 640 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F2F6",
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  headerRow: { borderTopWidth: 0, backgroundColor: "#FAFAFC", paddingVertical: 6 },
  headerText: { fontSize: 10, fontWeight: "700", color: Theme.textMuted, textTransform: "uppercase" },
  cell: { fontSize: 12, color: Theme.textPrimary },
  colDoc: { flex: 1.4, minWidth: 90 },
  colRequired: { flex: 0.6, minWidth: 50, textAlign: "center" },
  colStatus: { flex: 1, minWidth: 80 },
  colDate: { flex: 1, minWidth: 70, fontSize: 11 },
  colAction: { flex: 1.6, minWidth: 120 },
  docLabel: { fontWeight: "600" },
  muted: { color: Theme.textMuted, fontSize: 11 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { fontSize: 9, fontWeight: "700" },
  actionCell: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  actionLink: { fontSize: 11, fontWeight: "700", color: "#2563eb" },
  rejectLink: { color: "#d93025" },
});
