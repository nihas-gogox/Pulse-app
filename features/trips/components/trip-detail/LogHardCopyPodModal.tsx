/**
 * Manifest Management — Log Hard Copy POD drawer/modal.
 * Reuses trips.pod_* columns + record_trip_hard_copy_pod /
 * log_trip_hard_copy_pod_courier RPCs. Does not create duplicate POD rows.
 */
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { HardCopyPodDateField } from "@/features/trips/components/trip-detail/HardCopyPodDateField";
import { HardCopyPodPhotoUpload } from "@/features/trips/components/trip-detail/HardCopyPodPhotoUpload";
import {
  encodeHardCopyPodComment,
  fetchTripHardCopyPodState,
  logTripHardCopyPodCourier,
  markTripHardCopyPodReceived,
  type HardCopyPodReceiptMethod,
  type HardCopyPodStatus,
  type TripHardCopyPodState,
} from "@/features/trips/services/tripDocumentLrPod.service";
import { syncHardCopyPodRecord } from "@/lib/queries/invalidateHardCopyPodCaches";
import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HARD_COPY_POD_COURIERS = [
  "BlueDart",
  "DHL",
  "DTDC",
  "Delhivery",
  "FedEx",
  "Ecom Express",
  "Professional Couriers",
  "India Post",
] as const;

function courierNameOptions(current: string): string[] {
  const saved = current.trim();
  const base = [...HARD_COPY_POD_COURIERS];
  if (!saved || base.includes(saved)) return base;
  return [saved, ...base];
}

export type HardCopyPodManifestSummary = {
  manifestId: string;
  clientName: string;
  pickup: string;
  delivery: string;
  driverName: string;
  vehicleLabel: string;
};

type Mode = "create" | "view" | "mark_received";

function statusLabel(status: HardCopyPodStatus): string {
  if (status === "IN_TRANSIT") return "IN TRANSIT";
  return status;
}

function statusColor(status: HardCopyPodStatus): string {
  if (status === "RECEIVED") return Theme.positive;
  if (status === "IN_TRANSIT") return Theme.warning;
  return Theme.textMuted;
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const raw = String(iso).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LogHardCopyPodModal({
  visible,
  onClose,
  tripId,
  organizationId,
  canManage,
  summary,
  initialMode = "create",
  onUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  organizationId?: string | null;
  canManage: boolean;
  summary: HardCopyPodManifestSummary;
  initialMode?: Mode;
  onUpdated?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isNarrow = width < 720;
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loadingState, setLoadingState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [podState, setPodState] = useState<TripHardCopyPodState | null>(null);

  const [method, setMethod] = useState<HardCopyPodReceiptMethod | null>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedTime, setReceivedTime] = useState("");
  const [courierName, setCourierName] = useState("");
  const [awbNumber, setAwbNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshState = useCallback(async () => {
    setLoadingState(true);
    const { error, state } = await fetchTripHardCopyPodState(tripId);
    setLoadingState(false);
    if (error) {
      Alert.alert("Hard Copy POD", error.message);
      return null;
    }
    setPodState(state);
    return state;
  }, [tripId]);

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setErrors({});
    void refreshState().then((state) => {
      if (!state) return;
      if (state.status === "RECEIVED" || state.status === "IN_TRANSIT") {
        setMode(initialMode === "mark_received" ? "mark_received" : "view");
        setMethod(state.receiptMethod);
        setReceivedBy(state.receivedBy ?? "");
        setReceivedDate(state.receivedDate ?? "");
        setReceivedTime(state.receivedTime ?? "");
        setCourierName(state.courier ?? "");
        setAwbNumber(state.awbNumber ?? "");
        setDispatchDate(state.dispatchDate ?? "");
        setExpectedDeliveryDate(state.expectedDeliveryDate ?? "");
        setRemarks(state.remarks ?? "");
      } else {
        setMode("create");
        setMethod(null);
        setReceivedBy("");
        setReceivedDate("");
        setReceivedTime("");
        setCourierName("");
        setAwbNumber("");
        setDispatchDate("");
        setExpectedDeliveryDate("");
        setRemarks("");
      }
    });
  }, [visible, initialMode, refreshState]);

  const invalidate = useCallback(async () => {
    await syncHardCopyPodRecord(queryClient, {
      tripId,
      organizationId,
    });
    onUpdated?.();
  }, [onUpdated, organizationId, queryClient, tripId]);

  const validateCreate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!method) {
      next.method = "Select how the hard copy POD was received.";
    } else if (method === "person") {
      if (!receivedBy.trim()) next.receivedBy = "Person name is required.";
      if (!receivedDate.trim()) next.receivedDate = "Received date is required.";
    } else {
      if (!courierName.trim()) next.courierName = "Courier name is required.";
      if (!awbNumber.trim()) next.awbNumber = "Tracking / AWB number is required.";
      if (!dispatchDate.trim()) next.dispatchDate = "Dispatch date is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [
    awbNumber,
    courierName,
    dispatchDate,
    method,
    receivedBy,
    receivedDate,
  ]);

  const validateMarkReceived = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!receivedBy.trim()) next.receivedBy = "Person name is required.";
    if (!receivedDate.trim()) next.receivedDate = "Received date is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [receivedBy, receivedDate]);

  const handleSaveCreate = useCallback(async () => {
    if (!canManage || saving) return;
    if (!validateCreate() || !method) {
      Alert.alert(
        "Hard Copy POD",
        method === "courier"
          ? "Enter the courier name, tracking number, and dispatch date."
          : "Enter who received the POD and the received date.",
      );
      return;
    }
    setSaving(true);
    if (method === "person") {
      const { error, alreadyReceived } = await markTripHardCopyPodReceived(tripId, {
        receivedBy: receivedBy.trim(),
        comment: encodeHardCopyPodComment({
          remarks,
          receivedDate,
          receivedTime,
          receiptMethod: "person",
        }),
      });
      setSaving(false);
      if (error) {
        Alert.alert("Hard Copy POD", error.message);
        return;
      }
      if (alreadyReceived) {
        Alert.alert(
          "Hard Copy POD",
          "This trip's hard-copy POD was already recorded as received.",
        );
      }
    } else {
      const comment = encodeHardCopyPodComment({
        remarks,
        receiptMethod: "courier",
        dispatchDate,
        expectedDeliveryDate,
      });
      const logged = await logTripHardCopyPodCourier(tripId, {
        courier: courierName.trim(),
        awbNumber: awbNumber.trim(),
        dispatchDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        remarks: remarks || null,
      });
      const recorded = await markTripHardCopyPodReceived(tripId, {
        courier: courierName.trim(),
        awbNumber: awbNumber.trim(),
        comment,
      });
      setSaving(false);
      if (recorded.error && logged.error) {
        Alert.alert("Hard Copy POD", recorded.error.message);
        return;
      }
      if (recorded.error && !logged.error) {
        await invalidate();
        onClose();
        return;
      }
      if (recorded.alreadyReceived && logged.alreadyReceived) {
        Alert.alert(
          "Hard Copy POD",
          "This trip's hard-copy POD was already marked received.",
        );
      }
    }
    await invalidate();
    onClose();
  }, [
    awbNumber,
    canManage,
    courierName,
    dispatchDate,
    expectedDeliveryDate,
    invalidate,
    method,
    onClose,
    receivedBy,
    receivedDate,
    receivedTime,
    remarks,
    saving,
    tripId,
    validateCreate,
  ]);

  const handleConfirmReceived = useCallback(async () => {
    if (!canManage || saving || !validateMarkReceived()) return;
    setSaving(true);
    const { error, alreadyReceived } = await markTripHardCopyPodReceived(tripId, {
      receivedBy: receivedBy.trim(),
      courier: (podState?.courier ?? courierName).trim() || null,
      awbNumber: (podState?.awbNumber ?? awbNumber).trim() || null,
      comment: encodeHardCopyPodComment({
        remarks,
        receivedDate,
        receiptMethod: "courier",
      }),
    });
    setSaving(false);
    if (error) {
      Alert.alert("Hard Copy POD", error.message);
      return;
    }
    if (alreadyReceived) {
      Alert.alert(
        "Hard Copy POD",
        "This trip's hard-copy POD was already recorded as received.",
      );
    }
    await invalidate();
    onClose();
  }, [
    awbNumber,
    canManage,
    courierName,
    invalidate,
    onClose,
    podState?.awbNumber,
    podState?.courier,
    receivedBy,
    receivedDate,
    remarks,
    saving,
    tripId,
    validateMarkReceived,
  ]);

  const panelWidth = useMemo(
    () => (isNarrow ? width : Math.min(440, width * 0.42)),
    [isNarrow, width],
  );

  const title =
    mode === "mark_received"
      ? "Confirm POD Received"
      : mode === "view"
        ? "Hard Copy POD"
        : "Hard Copy POD";

  const subtitle =
    mode === "mark_received"
      ? "Confirm physical receipt of the courier POD."
      : "Record the physical POD receipt for this manifest.";

  const readOnly = mode === "view";
  const showCreateForm = mode === "create";
  const showMarkReceived = mode === "mark_received";

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isNarrow ? "slide" : "fade"}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.panel,
            {
              width: isNarrow ? "100%" : panelWidth,
              maxWidth: isNarrow ? "100%" : 480,
              paddingTop: isNarrow ? insets.top + 12 : 20,
              paddingBottom: Math.max(insets.bottom, 16),
              alignSelf: isNarrow ? "stretch" : "flex-end",
              height: isNarrow ? "100%" : "100%",
              borderTopLeftRadius: isNarrow ? 0 : 16,
              borderBottomLeftRadius: isNarrow ? 0 : 16,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close hard copy POD"
            >
              <Feather name="x" size={18} color={Theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.summaryCard}>
              <SummaryRow label="Manifest ID" value={summary.manifestId} />
              <SummaryRow label="Client" value={summary.clientName} />
              <SummaryRow label="Pickup" value={summary.pickup} />
              <SummaryRow label="Delivery" value={summary.delivery} />
              <SummaryRow label="Driver" value={summary.driverName} />
              <SummaryRow label="Vehicle" value={summary.vehicleLabel} />
            </View>

            {loadingState ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={Theme.analyticsHeroBg} />
            ) : null}

            {readOnly && podState ? (
              <View style={styles.section}>
                <View style={styles.statusPillRow}>
                  <Text style={styles.sectionTitle}>POD Status</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusColor(podState.status)}18` },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor(podState.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: statusColor(podState.status) },
                      ]}
                    >
                      {statusLabel(podState.status)}
                    </Text>
                  </View>
                </View>
                <DetailRow
                  label="Receipt Method"
                  value={
                    podState.receiptMethod === "courier"
                      ? "Received by Courier"
                      : podState.receiptMethod === "person"
                        ? "Received by Person"
                        : "—"
                  }
                />
                {podState.receiptMethod === "courier" ? (
                  <>
                    <DetailRow label="Courier" value={podState.courier ?? "—"} />
                    <DetailRow label="Tracking / AWB" value={podState.awbNumber ?? "—"} emphasize />
                    <DetailRow
                      label="Dispatch Date"
                      value={formatDisplayDate(podState.dispatchDate)}
                    />
                    <DetailRow
                      label="Received Delivery Date"
                      value={formatDisplayDate(podState.expectedDeliveryDate)}
                    />
                  </>
                ) : null}
                {podState.status === "RECEIVED" ? (
                  <>
                    <DetailRow label="Received By" value={podState.receivedBy ?? "—"} />
                    <DetailRow
                      label="Received Date"
                      value={
                        formatDisplayDate(podState.receivedDate) !== "—"
                          ? formatDisplayDate(podState.receivedDate)
                          : formatDisplayDate(podState.receivedAt)
                      }
                    />
                    {podState.receivedTime ? (
                      <DetailRow label="Received Time" value={podState.receivedTime} />
                    ) : null}
                  </>
                ) : null}
                {podState.remarks ? (
                  <DetailRow label="Remarks" value={podState.remarks} />
                ) : null}

                <HardCopyPodPhotoUpload tripId={tripId} canEdit={canManage} />

                {canManage && podState.status === "IN_TRANSIT" ? (
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      setMode("mark_received");
                      setReceivedBy("");
                      setReceivedDate("");
                      setRemarks(podState.remarks ?? "");
                      setErrors({});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Mark as Received"
                  >
                    <Text style={styles.primaryBtnText}>Mark as Received</Text>
                  </Pressable>
                ) : null}

                {canManage && podState.status === "IN_TRANSIT" ? (
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setMode("create");
                      setMethod("courier");
                      setErrors({});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit courier POD"
                  >
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {showCreateForm ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  How was the hard copy POD received?
                </Text>
                {errors.method ? (
                  <Text style={styles.errorText}>{errors.method}</Text>
                ) : null}
                <View style={styles.segmentRow}>
                  <Pressable
                    style={[
                      styles.segmentCard,
                      method === "person" && styles.segmentCardActive,
                    ]}
                    onPress={() => {
                      setMethod("person");
                      setErrors((e) => {
                        const { method: _m, ...rest } = e;
                        return rest;
                      });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === "person" }}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        method === "person" && styles.radioOuterActive,
                      ]}
                    >
                      {method === "person" ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.segmentTitle,
                          method === "person" && styles.segmentTitleActive,
                        ]}
                      >
                        Received by Person
                      </Text>
                      <Text style={styles.segmentHint}>Handed over in person</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.segmentCard,
                      method === "courier" && styles.segmentCardActive,
                    ]}
                    onPress={() => {
                      setMethod("courier");
                      setErrors((e) => {
                        const { method: _m, ...rest } = e;
                        return rest;
                      });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === "courier" }}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        method === "courier" && styles.radioOuterActive,
                      ]}
                    >
                      {method === "courier" ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.segmentTitle,
                          method === "courier" && styles.segmentTitleActive,
                        ]}
                      >
                        Received by Courier
                      </Text>
                      <Text style={styles.segmentHint}>Dispatched via courier</Text>
                    </View>
                  </Pressable>
                </View>

                {method === "person" ? (
                  <View style={styles.fields}>
                    <Field
                      label="Received by"
                      required
                      value={receivedBy}
                      onChangeText={setReceivedBy}
                      placeholder="Person name"
                      error={errors.receivedBy}
                    />
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateTimeCol}>
                        <HardCopyPodDateField
                          label="Received date"
                          required
                          value={receivedDate}
                          onChange={setReceivedDate}
                          error={errors.receivedDate}
                        />
                      </View>
                      <View style={styles.dateTimeCol}>
                        <Field
                          label="Received time"
                          value={receivedTime}
                          onChangeText={setReceivedTime}
                          placeholder="HH:MM"
                        />
                      </View>
                    </View>
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateTimeCol}>
                        <Field
                          label="Remarks"
                          value={remarks}
                          onChangeText={setRemarks}
                          placeholder="Optional remarks"
                          multiline
                        />
                      </View>
                      <View style={styles.dateTimeCol}>
                        <HardCopyPodPhotoUpload tripId={tripId} canEdit={canManage} />
                      </View>
                    </View>
                  </View>
                ) : null}

                {method === "courier" ? (
                  <View style={styles.fields}>
                    <CourierNameField
                      value={courierName}
                      error={errors.courierName}
                      onChange={(name) => {
                        markDraftDirty();
                        setCourierName(name);
                        setErrors((current) => {
                          const { courierName: _removed, ...rest } = current;
                          return rest;
                        });
                      }}
                    />
                    <Field
                      label="Tracking / AWB Number"
                      required
                      value={awbNumber}
                      onChangeText={setAwbNumber}
                      placeholder="Primary courier reference"
                      error={errors.awbNumber}
                      emphasize
                    />
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateTimeCol}>
                        <HardCopyPodDateField
                          label="Dispatch Date"
                          required
                          value={dispatchDate}
                          onChange={setDispatchDate}
                          error={errors.dispatchDate}
                        />
                      </View>
                      <View style={styles.dateTimeCol}>
                        <HardCopyPodDateField
                          label="Received Delivery Date"
                          value={expectedDeliveryDate}
                          onChange={setExpectedDeliveryDate}
                        />
                      </View>
                    </View>
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateTimeCol}>
                        <Field
                          label="Remarks"
                          value={remarks}
                          onChangeText={setRemarks}
                          placeholder="Optional remarks"
                          multiline
                        />
                      </View>
                      <View style={styles.dateTimeCol}>
                        <HardCopyPodPhotoUpload tripId={tripId} canEdit={canManage} />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showMarkReceived ? (
              <View style={styles.section}>
                {podState?.courier || podState?.awbNumber ? (
                  <View style={styles.summaryCard}>
                    <SummaryRow label="Courier" value={podState.courier ?? "—"} />
                    <SummaryRow
                      label="Tracking"
                      value={podState.awbNumber ?? "—"}
                    />
                  </View>
                ) : null}
                <View style={styles.fields}>
                  <HardCopyPodDateField
                    label="Received Date"
                    required
                    value={receivedDate}
                    onChange={setReceivedDate}
                    error={errors.receivedDate}
                  />
                  <Field
                    label="Received By"
                    required
                    value={receivedBy}
                    onChangeText={setReceivedBy}
                    placeholder="Person name"
                    error={errors.receivedBy}
                  />
                  <View style={styles.dateTimeRow}>
                    <View style={styles.dateTimeCol}>
                      <Field
                        label="Remarks"
                        value={remarks}
                        onChangeText={setRemarks}
                        placeholder="Optional"
                        multiline
                      />
                    </View>
                    <View style={styles.dateTimeCol}>
                      <HardCopyPodPhotoUpload tripId={tripId} canEdit={canManage} />
                    </View>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {showCreateForm && canManage ? (
              <>
                <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={saving}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    styles.footerPrimary,
                    (!method || saving) && styles.btnDisabled,
                  ]}
                  onPress={() => void handleSaveCreate()}
                  disabled={!method || saving}
                  accessibilityRole="button"
                  accessibilityLabel="Save hard copy POD"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={Theme.buttonPrimaryText} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </Pressable>
              </>
            ) : null}
            {showMarkReceived && canManage ? (
              <>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => setMode("view")}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    styles.footerPrimary,
                    saving && styles.btnDisabled,
                  ]}
                  onPress={() => void handleConfirmReceived()}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm Received"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={Theme.buttonPrimaryText} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Confirm Received</Text>
                  )}
                </Pressable>
              </>
            ) : null}
            {readOnly ? (
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, emphasize && styles.detailValueEmphasize]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function CourierNameField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (name: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = courierNameOptions(value);
  const selected = value.trim();

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        Courier Name
        <Text style={styles.req}> *</Text>
      </Text>
      {Platform.OS === "web" ? (
        <View style={[styles.input, styles.courierSelect, error ? styles.inputError : null]}>
          {createElement(
            "select",
            {
              value: selected,
              "aria-label": "Courier Name",
              "aria-required": true,
              "aria-invalid": Boolean(error),
              onChange: (event: { target: { value: string } }) => {
                choose(event.target.value);
              },
              style: {
                flex: 1,
                minWidth: 0,
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                fontWeight: "500",
                color: selected ? Theme.textPrimaryDark : Theme.textMuted,
                fontFamily: "inherit",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
              },
            },
            createElement("option", { value: "", disabled: true }, "Select courier"),
            ...options.map((name) =>
              createElement("option", { key: name, value: name }, name),
            ),
          )}
          <View pointerEvents="none">
            <Feather name="chevron-down" size={16} color={Theme.textMuted} />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.input, styles.courierSelect, error ? styles.inputError : null]}
          accessibilityRole="button"
          accessibilityLabel="Courier Name"
          accessibilityHint="Opens the courier list"
          accessibilityState={{ expanded: open }}
        >
          <Text
            style={[styles.courierValue, !selected && styles.courierPlaceholder]}
            numberOfLines={1}
          >
            {selected || "Select courier"}
          </Text>
          <Feather name="chevron-down" size={16} color={Theme.textMuted} />
        </Pressable>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {Platform.OS === "web" ? null : (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.courierBackdrop} onPress={() => setOpen(false)}>
            <View style={styles.courierSheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.courierSheetTitle}>Courier Name</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {options.map((name) => {
                  const active = name === selected;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => choose(name)}
                      style={[styles.courierOption, active && styles.courierOptionActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.courierOptionText,
                          active && styles.courierOptionTextActive,
                        ]}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  error,
  emphasize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          emphasize && styles.inputEmphasize,
          error ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    backgroundColor: Theme.cardWhite,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Theme.borderLight,
    ...Platform.select({
      web: {
        boxShadow: "-8px 0 32px rgba(15,23,42,0.12)",
      } as object,
      default: {
        shadowColor: Theme.shadow,
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.analyticsHeroBg,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.textSecondary,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.surfaceGray,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.surfaceGray,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  summaryLabel: {
    width: 88,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
    paddingTop: 2,
  },
  summaryValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  statusPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  segmentRow: { gap: 10 },
  segmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
    padding: 14,
    minHeight: Layout.minTouchTargetSize,
  },
  segmentCardActive: {
    borderColor: Theme.analyticsHeroBg,
    backgroundColor: "rgba(43,49,113,0.06)",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Theme.borderMedium,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: Theme.analyticsHeroBg },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.analyticsHeroBg,
  },
  segmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  segmentTitleActive: { color: Theme.analyticsHeroBg },
  segmentHint: {
    marginTop: 2,
    fontSize: 12,
    color: Theme.textMuted,
  },
  fields: { gap: 12 },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  dateTimeCol: {
    flex: 1,
    minWidth: 0,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  req: { color: Theme.warning },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.textPrimaryDark,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputEmphasize: {
    borderColor: Theme.analyticsHeroBg,
    borderWidth: 1.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  inputError: { borderColor: Theme.warning },
  courierSelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  courierValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
  },
  courierPlaceholder: {
    color: Theme.textMuted,
  },
  courierBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  courierSheet: {
    maxHeight: "70%",
    backgroundColor: Theme.cardWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  courierSheetTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  courierOption: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  courierOptionActive: {
    backgroundColor: Theme.surfaceGray,
  },
  courierOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  courierOptionTextActive: {
    color: Theme.analyticsHeroBg,
  },
  errorText: {
    fontSize: 11,
    color: Theme.warning,
    fontWeight: "600",
  },
  detailRow: { gap: 2 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  detailValueEmphasize: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.analyticsHeroBg,
    letterSpacing: 0.4,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.borderLight,
  },
  primaryBtn: {
    minHeight: Layout.minTouchTargetSize,
    borderRadius: Theme.buttonPrimaryRadius,
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  footerPrimary: { flex: 1.2 },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.buttonPrimaryText,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: Layout.minTouchTargetSize,
    borderRadius: Theme.buttonPrimaryRadius,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  btnDisabled: { opacity: 0.5 },
});
