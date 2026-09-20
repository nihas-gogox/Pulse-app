/**
 * The focused Compliance review experience — opened from a trip card's
 * Trip/Vehicle/Driver tiles or Verify Docs. Two steps in one Modal: a
 * document list with Approve/Decline on uploaded rows (Decline requires a note),
 * then a preview pane. Trip docs use trip_documents; vehicle/driver docs use
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
import { uploadAndSaveVehicleDocument } from "@/features/vehicles/services/vehicleDocuments.service";
import type { VehicleComplianceDocType } from "@/features/vehicles/utils/vehicleDocuments.util";
import { describeStopProofDocument, type StopProofDocumentSummary } from "@/features/driver/job-card/deliveryProof";
import { ComplianceDocumentPreviewModal } from "@/features/tripCompliance/components/ComplianceDocumentPreviewModal";
import {
  guessCompliancePreviewMime,
  signCompliancePreviewUrl,
} from "@/features/tripCompliance/services/complianceDocumentView.service";
import { ComplianceInputModal } from "@/features/tripCompliance/components/ComplianceInputModal";
import { COMPLIANCE_STATUS_META, ComplianceStatusChip } from "@/features/tripCompliance/components/ComplianceStatusIcon";
import { uploadTripDocument, isTripDocumentsStoragePathConflict, type TripDocumentType } from "@/features/trips/services/tripDocuments.service";
import {
  COMPLIANCE_TRIP_DOC_PICKER_TYPES,
  complianceTripDocFormatHint,
  validateComplianceTripDocumentFile,
} from "@/features/tripCompliance/utils/complianceTripDocumentFormat.util";
import { markTripComplianceVerified, setTripDocumentVerification } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import { canMarkComplianceVerified } from "@/features/tripCompliance/services/tripComplianceRead.service";
import {
  COMPLIANCE_DRIVER_DOCUMENT_TYPES,
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  type ComplianceChecklistGroup,
  type ComplianceDocumentRow,
  type ComplianceEntityDocument,
  type ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  deriveComplianceDocumentRows,
  deriveEntityComplianceRows,
  groupComplianceReviewRows,
  labelForDocType,
  requirementScopeLabel,
  requiredRowNextAction,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import {
  canModerateComplianceRow,
  complianceReviewDecisionActions,
} from "@/features/tripCompliance/utils/complianceReviewActions.util";
import { classifyPreviewFailure } from "@/features/tripCompliance/utils/compliancePreviewFailure.util";
import { formatMarkComplianceVerifiedError } from "@/features/tripCompliance/utils/complianceMarkVerifiedError.util";
import { deriveComplianceQueueReadiness } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import * as DocumentPicker from "expo-document-picker";
import { ChevronLeft, Eye, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
  canViewDocuments?: boolean;
  canVerify: boolean;
  canMarkVerified?: boolean;
  canManageFinance?: boolean;
  summary?: ComplianceTripSummary | null;
  initialSelectedKey?: string | null;
  onChanged: () => void;
  onPay?: () => void;
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
  canViewDocuments = true,
  canVerify,
  canMarkVerified = false,
  canManageFinance = false,
  summary = null,
  initialSelectedKey = null,
  onChanged,
  onPay,
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
  const [busy, setBusy] = useState(false);
  const [busyRowKey, setBusyRowKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ComplianceDocRow | null>(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [uploadingMissing, setUploadingMissing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryType, setRetryType] = useState<string | null>(null);
  const [markingVerified, setMarkingVerified] = useState(false);
  const [markVerifiedError, setMarkVerifiedError] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    title: string;
    url: string | null;
    mime: string | null;
    loading: boolean;
    placeProof: StopProofDocumentSummary | null;
  } | null>(null);

  const grouped = useMemo(() => groupComplianceReviewRows(rows), [rows]);
  const tripVerifyCheck = useMemo(() => canMarkComplianceVerified(documents), [documents]);
  const readiness = useMemo(() => (summary ? deriveComplianceQueueReadiness(summary) : null), [summary]);
  const selected: ComplianceDocRow | null = rows.find((r) => r.key === selectedKey) ?? null;
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
      setLightbox(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tripId, scope]);

  const stopProofForRow = useCallback((row: ComplianceDocRow | null) => {
    if (!row) return null;
    return describeStopProofDocument({
      fileName: row.doc?.file_name ?? row.entityDoc?.notes,
      mimeType: row.doc?.mime_type,
      documentNumber: row.doc?.document_number,
      storagePath: row.doc?.storage_path ?? row.entityDoc?.storage_path,
    });
  }, []);

  const openRowPreview = useCallback(
    async (row: ComplianceDocRow) => {
      const path = row.doc?.storage_path ?? row.entityDoc?.storage_path ?? null;
      const placeProof = stopProofForRow(row);
      const title = labelForDocType(row.type);
      if (placeProof) {
        setLightbox({ title, url: null, mime: "text/plain", loading: false, placeProof });
        return;
      }
      if (!path) {
        const failure = classifyPreviewFailure({ hasStoragePath: false });
        alertMessage("Document missing", failure.message);
        return;
      }
      if (!canViewDocuments) {
        alertMessage("Permission denied", "You don't have permission to preview this file.");
        return;
      }
      setViewingKey(row.key);
      setLightbox({ title, url: null, mime: null, loading: true, placeProof: null });
      try {
        const url = await signCompliancePreviewUrl({
          storagePath: path,
          source: scope === "trip" ? "trip" : row.entityDoc?.source,
        });
        setLightbox({
          title,
          url,
          mime: guessCompliancePreviewMime(path, row.doc?.mime_type),
          loading: false,
          placeProof: null,
        });
        if (!url) {
          const failure = classifyPreviewFailure({ hasStoragePath: true, url: null, mime: guessCompliancePreviewMime(path, row.doc?.mime_type) });
          alertMessage("Couldn't open document", failure.message);
        }
      } catch (e) {
        setLightbox(null);
        const failure = classifyPreviewFailure({ hasStoragePath: true, error: e });
        alertMessage("Couldn't open document", failure.message);
      } finally {
        setViewingKey(null);
      }
    },
    [scope, stopProofForRow, canViewDocuments],
  );

  const selectedStopProof = stopProofForRow(selected);

  const handleApprove = useCallback(
    async (row: ComplianceDocRow | null) => {
      if (!actorId || !row) return;
      setBusy(true);
      setBusyRowKey(row.key);
      if (scope === "trip") {
        if (!row.doc) {
          setBusy(false);
          setBusyRowKey(null);
          return;
        }
        const { error } = await setTripDocumentVerification({
          document: row.doc,
          organizationId,
          actorId,
          status: "verified",
        });
        setBusy(false);
        setBusyRowKey(null);
        if (error) {
          alertMessage("Couldn't approve document", error.message);
          return;
        }
      } else {
        if (!row.entityDoc || row.entityDoc.source === "vehicle-vault" || row.entityDoc.source === "driver-kyc") {
          setBusy(false);
          setBusyRowKey(null);
          return;
        }
        const { error } = await verifyDocument(row.entityDoc.id, actorId);
        setBusy(false);
        setBusyRowKey(null);
        if (error) {
          alertMessage("Couldn't approve document", error.message);
          return;
        }
      }
      onChanged();
    },
    [actorId, organizationId, onChanged, scope],
  );

  const handleRejectSubmit = useCallback(
    async (values: Record<string, string>) => {
      const row = rejectTarget ?? selected;
      if (!actorId || !row) return;
      setBusy(true);
      setBusyRowKey(row.key);
      if (scope === "trip") {
        if (!row.doc) {
          setBusy(false);
          setBusyRowKey(null);
          return;
        }
        const { error } = await setTripDocumentVerification({
          document: row.doc,
          organizationId,
          actorId,
          status: "rejected",
          rejectionReason: values.reason,
        });
        setBusy(false);
        setBusyRowKey(null);
        setRejectVisible(false);
        setRejectTarget(null);
        if (error) {
          alertMessage("Couldn't reject document", error.message);
          return;
        }
      } else {
        if (!row.entityDoc || row.entityDoc.source === "vehicle-vault" || row.entityDoc.source === "driver-kyc") {
          setBusy(false);
          setBusyRowKey(null);
          return;
        }
        const { error } = await rejectDocument(row.entityDoc.id, values.reason);
        setBusy(false);
        setBusyRowKey(null);
        setRejectVisible(false);
        setRejectTarget(null);
        if (error) {
          alertMessage("Couldn't reject document", error.message);
          return;
        }
      }
      onChanged();
    },
    [rejectTarget, selected, actorId, organizationId, onChanged, scope],
  );

  const handleMarkVerified = useCallback(async () => {
    if (!actorId) {
      const message = "Your session is missing an actor id. Sign in again, then retry.";
      setMarkVerifiedError(message);
      alertMessage("Couldn't mark compliance verified", message);
      return;
    }
    if (!tripVerifyCheck.ok) return;
    setMarkVerifiedError(null);
    setMarkingVerified(true);
    const { error } = await markTripComplianceVerified({ tripId, actorId });
    setMarkingVerified(false);
    if (error) {
      const message = formatMarkComplianceVerifiedError(error.message);
      setMarkVerifiedError(message);
      alertMessage("Couldn't mark compliance verified", message);
      return;
    }
    onChanged();
  }, [actorId, tripVerifyCheck.ok, tripId, onChanged]);

  const handleAddMissing = useCallback(
    async (type: string) => {
      if (!actorId) return;
      if (uploadingMissing) return;
      if (!entityAssigned) {
        alertMessage("Nothing to upload", unassignedMessage);
        return;
      }
      setUploadError(null);
      setRetryType(type);
      setUploadingMissing(true);
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
        if (scope === "trip") {
          const { error } = await uploadTripDocument(
            tripId,
            actorId,
            { arrayBuffer, fileName, mimeType: format.mimeType },
            type as TripDocumentType,
            undefined,
            { replaceExistingOfType: true },
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
              fileName,
              mimeType: format.mimeType,
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
              mimeType: format.mimeType,
              fileName,
            },
            uploadedBy: actorId,
          };
          const { error } = existing?.id
            ? await replaceComplianceDocument({ existingDocId: existing.id, upload })
            : await uploadComplianceDocument(upload);
          if (error) throw error;
        }
        onChanged();
        setRetryType(null);
      } catch (e) {
        const message = (e as Error).message;
        if (isTripDocumentsStoragePathConflict({ message })) {
          onChanged();
          setRetryType(null);
          setUploadError(null);
          return;
        }
        setUploadError(message);
        alertMessage("Couldn't add document", message);
      } finally {
        setUploadingMissing(false);
      }
    },
    [tripId, actorId, onChanged, scope, entityAssigned, entityId, organizationId, rows, unassignedMessage, vehicleId, uploadingMissing],
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
              <Text style={styles.hint}>{complianceTripDocFormatHint()}</Text>
              {scope === "trip" && readiness ? (
                <View style={styles.requiredSummary}>
                  <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
                  <Text style={styles.requiredCount}>
                    {readiness.requiredDocs.verified} / {readiness.requiredDocs.total} verified
                  </Text>
                  <Text style={styles.docMetaLine}>
                    Verified {readiness.requiredDocs.verified} · Pending {readiness.requiredDocs.pending} · Missing{" "}
                    {readiness.requiredDocs.missing} · Rejected {readiness.requiredDocs.rejected}
                  </Text>
                  <Text style={styles.docMetaLine}>Next: {readiness.nextAction}</Text>
                  <Text style={[styles.docMetaLine, readiness.paymentReady ? undefined : styles.rejectReasonText]}>
                    {readiness.paymentReady ? "Payment ready" : `Payment blocked — ${readiness.blockerLines[0] ?? "not ready"}`}
                  </Text>
                </View>
              ) : null}
              {uploadingMissing ? <Text style={styles.hint}>Uploading…</Text> : null}
              {uploadError ? (
                <Text style={styles.rejectReasonText}>
                  Upload failed: {uploadError}
                  {retryType && canVerify ? " Use Retry on that row." : ""}
                </Text>
              ) : null}
              {(
                [
                  ["Needs action", grouped.needsAction],
                  ["Missing", grouped.missing],
                  ["Pending verification", grouped.pending],
                  ["Verified", grouped.verified],
                ] as const
              ).map(([title, groupRows]) =>
                groupRows.length === 0 ? null : (
                  <View key={title}>
                    <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{title.toUpperCase()}</Text>
                    {groupRows.map((row) => {
                      const meta = COMPLIANCE_STATUS_META[row.status];
                      const decisions = complianceReviewDecisionActions(row);
                      const canModerate = canVerify && canModerateComplianceRow(row, scope);
                      const rowBusy = busy && busyRowKey === row.key;
                      return (
                        <View key={row.key} style={styles.docBlock}>
                          <View style={styles.docRow}>
                          <TouchableOpacity
                            style={styles.docRowMain}
                            disabled={row.status === "missing"}
                            onPress={() => setSelectedKey(row.key)}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.docRowLabel}>{labelForDocType(row.type)}</Text>
                              <Text style={styles.docMetaLine}>{requirementScopeLabel(row.required)}</Text>
                              <Text style={styles.docMetaLine}>
                                {row.doc?.uploaded_at ? `Uploaded ${formatDate(row.doc.uploaded_at)}` : row.entityDoc?.created_at ? `Uploaded ${formatDate(row.entityDoc.created_at)}` : "Not uploaded"}
                                {row.doc?.file_name
                                  ? ` · ${row.doc.file_name}`
                                  : row.doc?.uploaded_by
                                    ? ` · ${row.doc.uploaded_by.slice(0, 8)}`
                                    : ""}
                              </Text>
                              {row.status === "rejected" && (row.doc?.rejection_reason || row.entityDoc?.notes) ? (
                                <Text style={styles.rejectReasonText} numberOfLines={2}>
                                  Rejected — {row.doc?.rejection_reason || row.entityDoc?.notes}
                                </Text>
                              ) : (
                                <Text style={styles.docMetaLine}>{requiredRowNextAction(row)}</Text>
                              )}
                            </View>
                            <ComplianceStatusChip status={row.status} label={meta.label} compact />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void openRowPreview(row)}
                            disabled={viewingKey != null || !canViewDocuments}
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
                              <Text style={styles.addBtnText}>
                                {uploadingMissing && retryType === row.type
                                  ? "Uploading…"
                                  : uploadError && retryType === row.type
                                    ? "Retry"
                                    : row.status === "missing"
                                      ? "Upload"
                                      : "Replace"}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          </View>
                          {canModerate && (decisions.canApprove || decisions.canDecline) ? (
                            <View style={styles.decisionRow}>
                              {rowBusy ? (
                                <ActivityIndicator size="small" color={Theme.textMuted} />
                              ) : (
                                <>
                                  {decisions.canApprove ? (
                                    <TouchableOpacity
                                      style={styles.decisionApproveBtn}
                                      disabled={busy}
                                      onPress={() => void handleApprove(row)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Approve ${labelForDocType(row.type)}`}
                                    >
                                      <Text style={styles.approveBtnText}>Approve</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                  {decisions.canDecline ? (
                                    <TouchableOpacity
                                      style={styles.decisionDeclineBtn}
                                      disabled={busy}
                                      onPress={() => {
                                        setRejectTarget(row);
                                        setRejectVisible(true);
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Decline ${labelForDocType(row.type)}`}
                                    >
                                      <Text style={styles.rejectBtnText}>Decline</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </>
                              )}
                            </View>
                          ) : row.status === "missing" ? (
                            <Text style={styles.docMetaLine}>Upload a file before Approve / Decline.</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ),
              )}
              {scope === "trip" && canMarkVerified && summary?.complianceVerifiedAt ? (
                <Text style={styles.hint}>Compliance Verified ✓</Text>
              ) : null}
              {scope === "trip" && canMarkVerified && !summary?.complianceVerifiedAt ? (
                <View>
                  {!tripVerifyCheck.ok ? (
                    <Text style={styles.rejectReasonText}>
                      {[
                        readiness?.requiredDocs.missingLabels.length
                          ? `Missing: ${readiness.requiredDocs.missingLabels.join(", ")}`
                          : null,
                        readiness?.requiredDocs.pendingLabels.length
                          ? `Pending: ${readiness.requiredDocs.pendingLabels.join(", ")}`
                          : null,
                        readiness?.requiredDocs.rejectedLabels.length
                          ? `Rejected: ${readiness.requiredDocs.rejectedLabels.join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {markVerifiedError ? (
                    <Text style={styles.rejectReasonText}>{markVerifiedError}</Text>
                  ) : null}
                <TouchableOpacity
                  style={[styles.openDocBtn, !tripVerifyCheck.ok && styles.addBtn]}
                  disabled={!tripVerifyCheck.ok || markingVerified}
                  onPress={() => void handleMarkVerified()}
                >
                  <Text style={styles.openDocBtnText}>
                    {markingVerified
                      ? "Marking verified…"
                      : tripVerifyCheck.ok
                        ? "Mark Compliance Verified"
                        : "Mark Compliance Verified — blocked"}
                  </Text>
                </TouchableOpacity>
                </View>
              ) : null}
              {scope === "trip" && canManageFinance && readiness?.paymentReady && onPay ? (
                <TouchableOpacity style={styles.openDocBtn} onPress={onPay}>
                  <Text style={styles.openDocBtnText}>Pay {readiness.readyCategory === "compliance_balance" ? "balance" : "advance"}</Text>
                </TouchableOpacity>
              ) : null}
              {scope === "trip" && readiness ? (
                <Text style={styles.hint}>{readiness.blockerLines[0] ?? "Payment ready."}</Text>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView style={styles.previewScroll}>
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxLabel}>DOCUMENT PREVIEW</Text>
                {selectedStopProof ? (
                  <View style={styles.placeProofBox}>
                    <Text style={styles.placeProofLabel}>{selectedStopProof.label}</Text>
                    <Text style={styles.placeProofHint}>
                      {selectedStopProof.note ??
                        (selectedStopProof.kind === "pickup"
                          ? "Pickup place was recorded without a photo."
                          : "Delivery place was recorded without a photo.")}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => selected && void openRowPreview(selected)}
                    style={styles.openDocBtn}
                    disabled={viewingKey != null}
                  >
                    <Text style={styles.openDocBtnText}>
                      {viewingKey === selected?.key ? "Opening…" : "Preview"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.docTitle}>{labelForDocType(selected.type)}</Text>
              <Text style={styles.docMeta}>
                {uploadedAt ? `Uploaded ${formatDate(uploadedAt)}` : "Not uploaded"}
                {selected.doc?.uploaded_by ? ` · ${selected.doc.uploaded_by.slice(0, 8)}` : ""}
                {" · "}
                {statusMeta?.label ?? selected.status}
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
                        <TouchableOpacity style={styles.approveBtn} onPress={() => void handleApprove(selected)} disabled={busy}>
                          <Text style={styles.approveBtnText}>{busy ? "Approving…" : "Approve"}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {selected.status !== "rejected" ? (
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() => {
                            setRejectTarget(selected);
                            setRejectVisible(true);
                          }}
                        >
                          <Text style={styles.rejectBtnText}>Decline</Text>
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
        title="Decline document"
        fields={[{ key: "reason", label: "Note — why is this document being declined?", placeholder: "Enter reason", required: true }]}
        confirmLabel="Decline with note"
        onCancel={() => {
          setRejectVisible(false);
          setRejectTarget(null);
        }}
        onSubmit={handleRejectSubmit}
      />
      <ComplianceDocumentPreviewModal
        visible={lightbox != null}
        title={lightbox?.title ?? ""}
        url={lightbox?.url ?? null}
        mime={lightbox?.mime ?? null}
        loading={Boolean(lightbox?.loading)}
        placeProof={lightbox?.placeProof ?? null}
        onClose={() => setLightbox(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { width: "100%", maxWidth: 520, maxHeight: "80%", backgroundColor: Theme.cardWhite, borderRadius: 14, overflow: "hidden" },
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
  requiredSummary: { gap: 4, marginTop: 8, marginBottom: 4 },
  requiredCount: { fontSize: 14, fontWeight: "700", color: Theme.textPrimary },
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
  docBlock: { borderTopWidth: 0 },
  decisionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 10, alignItems: "center" },
  decisionApproveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: Theme.success,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  decisionDeclineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: Theme.complianceDocNeedBg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
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
  listScroll: { flexGrow: 1 },
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
  docMetaLine: { fontSize: 11, color: Theme.textMuted, marginTop: 2 },
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
