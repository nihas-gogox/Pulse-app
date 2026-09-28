import { ResponsiveDrawer } from "@/components/ResponsiveDrawer";
import Theme from "@/constants/Theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { TripCompletionOrPodTags } from "@/features/trips/components/TripPodStatusTags";
import { tripIsDeliveredStatus } from "@/features/trips/services/tripDocumentLrPod.service";
import { getDocumentViewUrl } from "@/features/trips/services/tripDocuments.service";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PodReconciliationTripView } from "../services/podReconciliationService";
import {
  derivePodDisplayStatus,
  derivePodNextAction,
  derivePodTimeline,
  podActionToneColor,
  podDisplayStatusLabel,
  type PodNextAction,
} from "../utils/podWorkflowDisplay.util";
import { PodProgressTimeline } from "./PodProgressTimeline";
import { PodWorkflowStatusBadge } from "./PodWorkflowStatusBadge";

type PodTripDetailDrawerProps = {
  trip: PodReconciliationTripView | null;
  visible: boolean;
  onClose: () => void;
  onAction: (action: PodNextAction, trip: PodReconciliationTripView) => void;
};

function safeDateText(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={3}>
        {value || "—"}
      </Text>
    </View>
  );
}

export function PodTripDetailDrawer({
  trip,
  visible,
  onClose,
  onAction,
}: PodTripDetailDrawerProps) {
  const insets = useSafeAreaInsets();
  const status = trip ? derivePodDisplayStatus(trip) : null;
  const action = trip ? derivePodNextAction(trip) : null;
  const timeline = useMemo(
    () => (trip ? derivePodTimeline(trip) : []),
    [trip],
  );

  const { data: attachments = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["pod-attachments-drawer", trip?.internal_id],
    queryFn: async () => {
      if (!trip?.internal_id) return [];
      const { data, error } = await supabase()
        .from("trip_documents")
        .select("id, storage_path, file_name, mime_type, document_type")
        .eq("trip_id", trip.internal_id)
        .eq("document_type", "pod");
      if (error) throw error;
      return data ?? [];
    },
    enabled: visible && !!trip?.internal_id,
  });

  if (!trip || !status || !action) {
    return null;
  }

  const invoiceLabel = trip.invoice_no?.trim()
    ? `Raised · ${trip.invoice_no}`
    : trip.invoice_status_display || trip.invoice_status_1 || "Pending";

  const actionColor = podActionToneColor(action.tone);

  return (
    <ResponsiveDrawer
      visible={visible}
      onClose={onClose}
      insets={insets}
      desktopWidth={440}
      tabletWidth={420}
      applyDrawerInsetPadding={false}
      mobileVariant="sheet"
    >
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kicker}>POD details</Text>
              <Text style={styles.tripId} numberOfLines={1}>
                {trip.id}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close POD details"
              hitSlop={12}
              style={styles.closeBtn}
            >
              <FontAwesome name="times" size={16} color={Theme.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.client} numberOfLines={1}>
            {trip.client_name || "—"}
          </Text>
          <View style={styles.headerMeta}>
            <PodWorkflowStatusBadge status={status} />
            <Text style={styles.amount}>
              ₹{(trip.amount || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          showsVerticalScrollIndicator
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip information</Text>
            <DetailRow label="Trip date" value={safeDateText(trip.trip_date || trip.date)} />
            <DetailRow
              label="Supplier / Driver"
              value={
                trip.vendor_name
                  ? trip.lane === "asset"
                    ? `${trip.vendor_name} · Driver`
                    : trip.vendor_name
                  : "—"
              }
            />
            <DetailRow
              label="LR number"
              value={
                trip.lr_numbers.length
                  ? trip.lr_numbers.join(", ")
                  : "—"
              }
            />
            <DetailRow label="Pickup" value={trip.pp_location || "—"} />
            <DetailRow label="Drop" value={trip.drop_point || "—"} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip status</Text>
            <TripCompletionOrPodTags
              tripCompleted={tripIsDeliveredStatus(trip.trip_status)}
              softCopyReceived={trip.soft_pod_received}
              hardCopyReceived={trip.hard_pod_received}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soft POD</Text>
            <Text style={styles.bodyText}>
              {trip.soft_pod_received
                ? "Digital POD document on file"
                : "No soft POD uploaded yet"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hard POD</Text>
            <Text style={styles.bodyText}>
              {trip.hard_pod_received
                ? `Received${trip.pod_received_date ? ` · ${safeDateText(trip.pod_received_date)}` : ""}`
                : "Hard copy not logged yet"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POD status</Text>
            <Text style={styles.bodyStrong}>{podDisplayStatusLabel(status)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice status</Text>
            <Text style={styles.bodyStrong}>{invoiceLabel}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POD progress</Text>
            <PodProgressTimeline steps={timeline} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POD documents</Text>
            {loadingDocs ? (
              <ActivityIndicator color={Theme.primary} />
            ) : attachments.length === 0 ? (
              <Text style={styles.bodyMuted}>
                No POD documents attached to this trip yet.
              </Text>
            ) : (
              attachments.map((doc) => (
                <Pressable
                  key={doc.id}
                  style={styles.docRow}
                  onPress={async () => {
                    try {
                      const path = String(doc.storage_path || "")
                        .replace(/^\/+/, "")
                        .replace(/^trip-documents\//, "");
                      const url = await getDocumentViewUrl(path);
                      if (url) {
                        if (Platform.OS === "web" && typeof window !== "undefined") {
                          window.open(url, "_blank", "noopener,noreferrer");
                        } else {
                          await Linking.openURL(url);
                        }
                      }
                    } catch {
                      // existing view helpers already surface errors elsewhere
                    }
                  }}
                >
                  <FontAwesome
                    name="file-o"
                    size={14}
                    color={Theme.primary}
                  />
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.file_name || "POD document"}
                  </Text>
                  <FontAwesome
                    name="external-link"
                    size={12}
                    color={Theme.textMuted}
                  />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Text style={styles.footerHint}>Next action</Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: actionColor }]}
            onPress={() => onAction(action, trip)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.primaryBtnText}>{action.label}</Text>
          </Pressable>
        </View>
      </View>
    </ResponsiveDrawer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.cardWhite,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
    gap: 10,
    backgroundColor: Theme.cardWhite,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tripId: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.surfaceGray,
  },
  client: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  scroll: {
    flex: 1,
    backgroundColor: Theme.surfaceGray,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  section: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.borderLight,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textMuted,
    width: 110,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textAlign: "right",
  },
  bodyText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  bodyStrong: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  bodyMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Theme.surfaceGray,
    marginBottom: 8,
  },
  docName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.borderMedium,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    backgroundColor: Theme.cardWhite,
  },
  footerHint: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  primaryBtn: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: Theme.cardWhite,
    fontSize: 14,
    fontWeight: "800",
  },
});
