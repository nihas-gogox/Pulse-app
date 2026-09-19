/**
 * The focused Compliance review experience — opened from a trip card's
 * Trip/Vehicle/Driver tiles or Verify Docs. Two steps in one Modal: a
 * document list, then (after selecting a document) a preview pane with
 * Approve/Reject. Trip docs use trip_documents; vehicle/driver docs use
 * entity_documents via documents.service.
 */
import Theme from "@/constants/Theme";
import {
  rejectDocument,
  replaceComplianceDocument,
  uploadComplianceDocument,
  verifyDocument,
} from "@/features/compliance/services/documents.service";
import { getVehicleById } from "@/features/vehicles/services/vehicles.service";
import { useDocumentPreview } from "@/features/chat/components/DocumentPreviewModal";
import { uploadAndSaveVehicleDocument } from "@/features/vehicles/services/vehicleDocuments.service";
import type { VehicleComplianceDocType } from "@/features/vehicles/utils/vehicleDocuments.util";
import {
  guessCompliancePreviewMime,
  resolveComplianceDocumentViewUrl,
} from "@/features/tripCompliance/services/complianceDocumentView.service";
import { ComplianceInputModal } from "@/features/tripCompliance/components/ComplianceInputModal";
import { COMPLIANCE_STATUS_META, ComplianceStatusChip } from "@/features/tripCompliance/components/ComplianceStatusIcon";
import { setTripDocumentVerification } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import {
  COMPLIANCE_DRIVER_DOCUMENT_TYPES,
  COMPLIANCE_TRIP_OTHER_DOCUMENT_TYPES,
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  type ComplianceChecklistGroup,
  type ComplianceDocumentRow,
  type ComplianceEntityDocument,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  deriveComplianceDocumentRows,
  deriveEntityComplianceRows,
  labelForDocType,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import { PdfViewer } from "@/components/PdfViewer";
import { describeStopProofDocument } from "@/features/driver/job-card/deliveryProof";
import { uploadTripDocument, type TripDocumentType } from "@/features/trips/services/tripDocuments.service";
import * as DocumentPicker from "expo-document-picker";
import { ChevronLeft, Eye, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

const VAULT_VEHICLE_TYPES = new Set(["rc", "insurance", "fitness", "pollution"]);

export type ComplianceReviewScope = ComplianceChecklistGroup["key"];

const SCOPE_COPY: Record<
  ComplianceReviewScope,
  { title: string; section: string; hint: string }
> = {
  trip: {
    title: "Compliance Review",
    section: "LR, E-WAY BILL, INVOICE",
    hint: "Upload or select LR, e-way bill, invoice, or another trip document.",
  },
  vehicle: {
    title: "Vehicle documents",
    section: "RC, INSURANCE, FC, PERMIT, POLLUTION, TAX",
    hint: "Upload or select RC, insurance, FC, permit, pollution, or tax.",
  },
  driver: {
    title: "Driver documents",
    section: "LICENCE & AADHAAR",
    hint: "Upload or select driving licence or Aadhaar.",
  },
};

export type ComplianceDocumentReviewSheetProps = {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripLabel: string;
  organizationId: string;
  actorId: string | null;
  documents: ComplianceDocumentRow[];
  canVerify: boolean;
  initialSelectedKey?: string | null;
  onChanged: () => void;
  scope?: ComplianceReviewScope;
  vehicleId?: string | null;
  driverId?: string | null;
  vehicleDocuments?: ComplianceEntityDocument[];
  driverDocuments?: ComplianceEntityDocument[];
  vehicleLabel?: string;
  driverLabel?: string;
};

export function ComplianceDocumentReviewSheet({
  visible,
  onClose,
  tripId,
  tripLabel,
  organizationId,
  actorId,
  documents,
  canVerify,
  initialSelectedKey = null,
  onChanged,
  scope = "trip",
  vehicleId = null,
  driverId = null,
  vehicleDocuments = [],
  driverDocuments = [],
  vehicleLabel = "Unassigned",
  driverLabel = "Unassigned",
}: ComplianceDocumentReviewSheetProps) {
  const rows = useMemo(() => {
    if (scope === "vehicle") return deriveEntityComplianceRows(COMPLIANCE_VEHICLE_DOCUMENT_TYPES, vehicleDocuments);
    if (scope === "driver") return deriveEntityComplianceRows(COMPLIANCE_DRIVER_DOCUMENT_TYPES, driverDocuments);
    return deriveComplianceDocumentRows(documents);
  }, [scope, documents, vehicleDocuments, driverDocuments]);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialSelectedKey);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [uploadingMissing, setUploadingMissing] = useState(false);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const { open: openDocPreview, node: docPreviewNode } = useDocumentPreview();

  const selected: ComplianceDocRow | null = rows.find((r) => r.key === selectedKey) ?? null;
  const selectedStopProof = selected
    ? describeStopProofDocument({
        fileName: selected.doc?.file_name ?? selected.entityDoc?.notes,
        mimeType: selected.doc?.mime_type,
        documentNumber: selected.doc?.document_number,
        storagePath: selected.doc?.storage_path ?? selected.entityDoc?.storage_path,
      })
    : null;
  const canModerateSelected =
    scope === "trip"
      ? Boolean(selected?.doc)
      : selected?.entityDoc?.source !== "vehicle-vault" && selected?.entityDoc?.source !== "driver-kyc";
  const copy = SCOPE_COPY[scope];
  const entityId = scope === "vehicle" ? vehicleId : scope === "driver" ? driverId : tripId;
  const entityAssigned = scope === "trip" || Boolean(entityId);
  const subtitle = scope === "vehicle" ? vehicleLabel : scope === "driver" ? driverLabel : tripLabel;
  const unassignedMessage =
    scope === "vehicle"
      ? "Assign a vehicle on this trip before uploading documents."
      : "Assign a driver on this trip before uploading documents.";

  useEffect(() => {
    if (visible) {
      setSelectedKey(initialSelectedKey);
    } else {
      setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tripId, scope]);

  const resolveRowViewUrl = useCallback(
    (row: ComplianceDocRow | null) => {
      if (!row) return Promise.resolve(null);
      return resolveComplianceDocumentViewUrl({
        storagePath: row.doc?.storage_path ?? row.entityDoc?.storage_path,
        source: scope === "trip" ? "trip" : row.entityDoc?.source,
        organizationId,
        entityId,
        docType: row.type,
      });
    },
    [entityId, organizationId, scope],
  );

  const openResolvedPreview = useCallback(
    async (url: string, path: string | null | undefined, label: string) => {
      await openDocPreview(url, guessCompliancePreviewMime(path ?? url), label);
    },
    [openDocPreview],
  );

  useEffect(() => {
    let cancelled = false;
    if (!selected || selectedStopProof) {
      setPreviewUrl(null);
      return () => {
        cancelled = true;
      };
    }
    void resolveRowViewUrl(selected).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [resolveRowViewUrl, selected, selectedStopProof?.code, selectedStopProof?.kind]);

  const handleOpenDocument = useCallback(() => {
    if (!previewUrl || !selected) return;
    void openResolvedPreview(
      previewUrl,
      selected.doc?.storage_path ?? selected.entityDoc?.storage_path,
      labelForDocType(selected.type),
    );
  }, [openResolvedPreview, previewUrl, selected]);

  const handleViewRow = useCallback(
    async (row: ComplianceDocRow) => {
      const path = row.doc?.storage_path ?? row.entityDoc?.storage_path ?? null;
      const stopProof = describeStopProofDocument({
        fileName: row.doc?.file_name ?? row.entityDoc?.notes,
        mimeType: row.doc?.mime_type,
        documentNumber: row.doc?.document_number,
        storagePath: path,
      });
      if (stopProof) {
        setSelectedKey(row.key);
        return;
      }
      if (!path && !(organizationId && entityId && row.type)) {
        alertMessage("No document", `${labelForDocType(row.type)} has not been uploaded yet.`);
        return;
      }
      setViewingKey(row.key);
      try {
        const url = await resolveRowViewUrl(row);
        if (!url) {
          alertMessage("Couldn't open document", "No preview is available for this file.");
          return;
        }
        await openResolvedPreview(url, path, labelForDocType(row.type));
      } catch (e) {
        alertMessage("Couldn't open document", (e as Error).message);
      } finally {
        setViewingKey(null);
      }
    },
    [entityId, openResolvedPreview, organizationId, resolveRowViewUrl],
  );

  const handleApprove = useCallback(async () => {
    if (!actorId) return;
    setBusy(true);
    if (scope === "trip") {
      if (!selected?.doc) {
        setBusy(false);
        return;
      }
      const { error } = await setTripDocumentVerification({
        document: selected.doc,
        organizationId,
        actorId,
        status: "verified",
      });
      setBusy(false);
      if (error) {
        alertMessage("Couldn't approve document", error.message);
        return;
      }
    } else {
      if (!selected?.entityDoc || selected.entityDoc.source === "vehicle-vault" || selected.entityDoc.source === "driver-kyc") {
        setBusy(false);
        return;
      }
      const { error } = await verifyDocument(selected.entityDoc.id, actorId);
      setBusy(false);
      if (error) {
        alertMessage("Couldn't approve document", error.message);
        return;
      }
    }
    onChanged();
  }, [selected, actorId, organizationId, onChanged, scope]);

  const handleRejectSubmit = useCallback(
    async (values: Record<string, string>) => {
      if (!actorId) return;
      setBusy(true);
      if (scope === "trip") {
        if (!selected?.doc) {
          setBusy(false);
          return;
        }
        const { error } = await setTripDocumentVerification({
          document: selected.doc,
          organizationId,
          actorId,
          status: "rejected",
          rejectionReason: values.reason,
        });
        setBusy(false);
        setRejectVisible(false);
        if (error) {
          alertMessage("Couldn't reject document", error.message);
          return;
        }
      } else {
        if (!selected?.entityDoc || selected.entityDoc.source === "vehicle-vault" || selected.entityDoc.source === "driver-kyc") {
          setBusy(false);
          return;
        }
        const { error } = await rejectDocument(selected.entityDoc.id, values.reason);
        setBusy(false);
        setRejectVisible(false);
        if (error) {
          alertMessage("Couldn't reject document", error.message);
          return;
        }
      }
      onChanged();
    },
    [selected, actorId, organizationId, onChanged, scope],
  );

  const handleAddMissing = useCallback(
    async (type: string) => {
      if (!actorId) return;
      if (!entityAssigned) {
        alertMessage("Nothing to upload", unassignedMessage);
        return;
      }
      setUploadingMissing(true);
      try {
        const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
        if (res.canceled || !res.assets[0]) return;
        const asset = res.assets[0];
        const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
        if (scope === "trip") {
          const { error } = await uploadTripDocument(
            tripId,
            actorId,
            { arrayBuffer, fileName: asset.name ?? `${type}.pdf`, mimeType: asset.mimeType ?? "application/pdf" },
            type as TripDocumentType,
          );
          if (error) throw error;
        } else if (scope === "vehicle" && VAULT_VEHICLE_TYPES.has(type) && vehicleId) {
          const { vehicle, error: vehicleError } = await getVehicleById(organizationId, vehicleId);
          if (vehicleError) throw vehicleError;
          const expiry =
            rows.find((row) => row.type === type)?.entityDoc?.expiry_date ??
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const { error } = await uploadAndSaveVehicleDocument(
            organizationId,
            vehicleId,
            type as VehicleComplianceDocType,
            {
              arrayBuffer,
              fileName: asset.name ?? `${type}.pdf`,
              mimeType: asset.mimeType ?? "application/pdf",
            },
            expiry,
            vehicle?.documents ?? null,
          );
          if (error) throw error;
        } else {
          const existing = rows.find((row) => row.type === type)?.entityDoc;
          if (existing?.source === "vehicle-vault" || existing?.source === "driver-kyc") {
            throw new Error("Replace this file from Trip Operations Asset Vault.");
          }
          const upload = {
            orgId: organizationId,
            entityType: scope,
            entityId: entityId as string,
            docType: type,
            file: {
              arrayBuffer,
              mimeType: asset.mimeType ?? "application/pdf",
              fileName: asset.name ?? `${type}.pdf`,
            },
            uploadedBy: actorId,
          };
          const { error } = existing?.id
            ? await replaceComplianceDocument({ existingDocId: existing.id, upload })
            : await uploadComplianceDocument(upload);
          if (error) throw error;
        }
        onChanged();
      } catch (e) {
        alertMessage("Couldn't add document", (e as Error).message);
      } finally {
        setUploadingMissing(false);
      }
    },
    [tripId, actorId, onChanged, scope, entityAssigned, entityId, organizationId, rows, unassignedMessage, vehicleId],
  );

  const uploadedAt = selected?.doc?.uploaded_at ?? selected?.entityDoc?.created_at ?? null;
  const verifiedAt = selected?.doc?.verified_at ?? selected?.entityDoc?.verified_at ?? null;
  const rejectionReason = selected?.doc?.rejection_reason ?? selected?.entityDoc?.notes ?? null;
  const statusMeta = selected ? COMPLIANCE_STATUS_META[selected.status] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            {selected ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedKey(null)}>
                <ChevronLeft size={16} color={Theme.textPrimary} strokeWidth={2.2} />
                <Text style={styles.backBtnText}>Back to documents</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.headerTitle}>{copy.title}</Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={Theme.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {!selected ? (
            <ScrollView style={styles.listScroll}>
              {!entityAssigned ? <Text style={styles.unassigned}>{unassignedMessage}</Text> : null}
              {rows.map((row, index) => {
                const meta = COMPLIANCE_STATUS_META[row.status];
                const showRequiredLabel = index === 0;
                const showOtherLabel = scope === "trip" && row.type === COMPLIANCE_TRIP_OTHER_DOCUMENT_TYPES[0];
                return (
                  <View key={row.key}>
                    {showRequiredLabel ? <Text style={styles.sectionLabel}>{copy.section}</Text> : null}
                    {showOtherLabel ? <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>OTHER DOCUMENTS</Text> : null}
                    <View style={styles.docRow}>
                      <TouchableOpacity
                        style={styles.docRowMain}
                        disabled={row.status === "missing"}
                        onPress={() => setSelectedKey(row.key)}
                      >
                        <Text style={styles.docRowLabel}>{labelForDocType(row.type)}</Text>
                        <ComplianceStatusChip status={row.status} label={meta.label} compact />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void handleViewRow(row)}
                        disabled={viewingKey != null}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${labelForDocType(row.type)}`}
                      >
                        {viewingKey === row.key ? (
                          <ActivityIndicator size="small" color={Theme.textMuted} />
                        ) : (
                          <Eye
                            size={16}
                            color={row.doc?.storage_path || row.entityDoc?.storage_path ? Theme.textPrimary : Theme.textMuted}
                            strokeWidth={2.2}
                          />
                        )}
                      </TouchableOpacity>
                      {canVerify && entityAssigned ? (
                        <TouchableOpacity
                          disabled={uploadingMissing}
                          onPress={() => handleAddMissing(row.type)}
                          style={styles.addBtn}
                        >
                          <Text style={styles.addBtnText}>{uploadingMissing ? "…" : row.status === "missing" ? "Upload" : "Replace"}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              <Text style={styles.hint}>{copy.hint}</Text>
            </ScrollView>
          ) : (
            <ScrollView style={styles.previewScroll}>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxLabel}>DOCUMENT PREVIEW</Text>
                {selectedStopProof ? (
                  <View style={styles.placeProofBox}>
                    <Text style={styles.placeProofLabel}>{selectedStopProof.label}</Text>
                    <Text style={styles.placeProofHint}>
                      {selectedStopProof.kind === "pickup"
                        ? "Pickup place was recorded without a photo."
                        : "Delivery place was recorded without a photo."}
                    </Text>
                  </View>
                ) : previewUrl ? (
                  <>
                    {guessCompliancePreviewMime(selected.doc?.storage_path ?? selected.entityDoc?.storage_path ?? previewUrl) === "application/pdf" ? (
                      <View style={styles.inlinePreview}>
                        <PdfViewer pdfUri={previewUrl} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: previewUrl }}
                        style={styles.inlinePreview}
                        resizeMode="contain"
                        accessibilityLabel={`${labelForDocType(selected.type)} preview`}
                      />
                    )}
                    <TouchableOpacity onPress={handleOpenDocument} style={styles.openDocBtn}>
                      <Text style={styles.openDocBtnText}>Open Document</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <ActivityIndicator size="small" color={Theme.textMuted} />
                )}
              </View>
              <Text style={styles.docTitle}>{labelForDocType(selected.type)}</Text>
              <Text style={styles.docMeta}>
                {uploadedAt ? `Uploaded ${formatDate(uploadedAt)}` : ""} · {statusMeta?.label ?? selected.status}
                {selected.status === "verified" && verifiedAt ? ` ${formatDate(verifiedAt)}` : ""}
              </Text>
              {selected.status === "rejected" && rejectionReason ? (
                <Text style={styles.rejectReasonText}>Reason: {rejectionReason}</Text>
              ) : null}

              {canVerify && canModerateSelected ? (
                <View style={styles.actionsRow}>
                  {busy ? (
                    <ActivityIndicator size="small" color={Theme.textMuted} />
                  ) : (
                    <>
                      {selected.status !== "verified" ? (
                        <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
                          <Text style={styles.approveBtnText}>✓ Approve</Text>
                        </TouchableOpacity>
                      ) : null}
                      {selected.status !== "rejected" ? (
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectVisible(true)}>
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>

      <ComplianceInputModal
        visible={rejectVisible}
        title="Reject document"
        fields={[{ key: "reason", label: "Why is this document being rejected?", placeholder: "Enter reason", required: true }]}
        confirmLabel="Reject Document"
        onCancel={() => setRejectVisible(false)}
        onSubmit={handleRejectSubmit}
      />
      {docPreviewNode}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 400, maxHeight: "72%", backgroundColor: Theme.cardWhite, borderRadius: 14, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.complianceCardBorder,
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Theme.textPrimary },
  headerSubtitle: { fontSize: 12, color: Theme.textMuted, marginTop: 2 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backBtnText: { fontSize: 13, fontWeight: "600", color: Theme.textPrimary },
  listScroll: { padding: 16 },
  unassigned: { fontSize: 12, color: Theme.textMuted, marginBottom: 10, lineHeight: 16 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: Theme.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  sectionLabelSpaced: { marginTop: 14 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.complianceCardBorder,
  },
  docRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  docRowLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: Theme.textPrimary, minWidth: 0 },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.compliancePageBg,
  },
  addBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: Theme.buttonDark, minHeight: 28, justifyContent: "center" },
  addBtnText: { fontSize: 11, fontWeight: "700", color: Theme.buttonDarkText },
  hint: { fontSize: 12, color: Theme.textMuted, textAlign: "center", marginTop: 16 },
  previewScroll: { padding: 16 },
  previewBox: {
    backgroundColor: Theme.compliancePageBg,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  inlinePreview: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  previewBoxLabel: { fontSize: 10, fontWeight: "700", color: Theme.textMuted, letterSpacing: 0.5 },
  placeProofBox: { width: "100%", alignItems: "center", gap: 6, paddingVertical: 12 },
  placeProofLabel: { fontSize: 16, fontWeight: "700", color: Theme.textPrimary, textAlign: "center" },
  placeProofHint: { fontSize: 12, color: Theme.textMuted, textAlign: "center", lineHeight: 16 },
  openDocBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Theme.buttonDark },
  openDocBtnText: { fontSize: 12, fontWeight: "700", color: Theme.buttonDarkText },
  docTitle: { fontSize: 15, fontWeight: "700", color: Theme.textPrimary },
  docMeta: { fontSize: 12, color: Theme.textMuted, marginTop: 2 },
  rejectReasonText: { fontSize: 12, color: Theme.teslaRed, marginTop: 6 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  approveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Theme.success, alignItems: "center" },
  approveBtnText: { fontSize: 13, fontWeight: "700", color: Theme.buttonDarkText },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Theme.complianceDocNeedBg,
    alignItems: "center",
  },
  rejectBtnText: { fontSize: 13, fontWeight: "700", color: Theme.teslaRed },
});
