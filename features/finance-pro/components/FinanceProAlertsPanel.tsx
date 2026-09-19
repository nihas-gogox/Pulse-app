/**
 * Finance Pro / Invoice / POD bell drawer — Core notifications chrome,
 * scoped to POD pending and invoice overdue only.
 */
import {
  RegistryCardActions,
  RegistryGhostButton,
} from "@/components/AlertRegistryCardActions";
import { AlertRegistrySignalCard } from "@/components/AlertRegistrySignalCard";
import Theme from "@/constants/Theme";
import { ROUTES } from "@/lib/routes";
import { formatFinanceInr } from "./financeProFormat";
import { useFinanceProChromeAlerts } from "../hooks/useFinanceProChromeAlerts";
import type {
  FinanceProChromeAlert,
  FinanceProChromeAlertKind,
} from "../model/financeProChromeAlerts.util";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const METRONIC = {
  border: "#EFF2F5",
  muted: "#A1A5B7",
  primaryBtn: "#181C32",
} as const;

type FilterTab = "all" | FinanceProChromeAlertKind;

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pod_pending", label: "POD" },
  { id: "invoice_overdue", label: "Invoice" },
];

export function FinanceProAlertsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { alerts, podPendingCount, invoiceOverdueCount, loading } =
    useFinanceProChromeAlerts();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const visible = useMemo(
    () =>
      filterTab === "all"
        ? alerts
        : alerts.filter((alert) => alert.kind === filterTab),
    [alerts, filterTab],
  );

  const tabCounts: Record<FilterTab, number> = {
    all: alerts.length,
    pod_pending: podPendingCount,
    invoice_overdue: invoiceOverdueCount,
  };

  const openTrip = (alert: FinanceProChromeAlert) => {
    onClose();
    router.push(ROUTES.financeProTrip(alert.tripId));
  };

  const empty =
    filterTab === "pod_pending"
      ? {
          title: "No POD pending",
          body: "Completed trips waiting on physical POD appear here.",
        }
      : filterTab === "invoice_overdue"
        ? {
            title: "No invoice overdue",
            body: "Invoiced trips with open exposure 31 days or older appear here.",
          }
        : {
            title: "You're all caught up",
            body: "POD pending and invoice overdue alerts will appear here.",
          };

  return (
    <View style={styles.shell} accessibilityRole="summary">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
          hitSlop={8}
        >
          <X size={16} color={METRONIC.muted} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const selected = filterTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <Pressable
              key={tab.id}
              onPress={() => setFilterTab(tab.id)}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                count > 0 ? `${tab.label}, ${count} items` : tab.label
              }
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 ? <View style={styles.tabUnreadDot} /> : null}
              </View>
              {selected ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {loading && alerts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Loading alerts…</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{empty.title}</Text>
            <Text style={styles.emptyBody}>{empty.body}</Text>
          </View>
        ) : (
          visible.map((alert) => (
            <AlertRegistrySignalCard
              key={alert.id}
              avatar={{
                name: alert.clientName,
                entityType: "client",
                initialsColorSeed: alert.clientId,
              }}
              actorName={alert.clientName}
              actionText={
                alert.kind === "pod_pending"
                  ? "has a trip waiting on POD"
                  : "has overdue invoiced exposure on"
              }
              highlightText={alert.tripLabel}
              detailTitle={formatFinanceInr(alert.amount)}
              detailSubtitle={
                alert.kind === "pod_pending"
                  ? "POD pending"
                  : `Open ${alert.daysOld ?? 0}d`
              }
              timeLabel={
                alert.daysOld == null ? "Unaged" : `${alert.daysOld}d`
              }
              contextLabel={
                alert.kind === "pod_pending" ? "POD" : "Collections"
              }
              tags={[
                {
                  label:
                    alert.kind === "pod_pending"
                      ? "pod pending"
                      : "invoice overdue",
                  variant: "default",
                },
              ]}
              isUnread
              onPress={() => openTrip(alert)}
              footer={
                <RegistryCardActions>
                  <RegistryGhostButton
                    label="Open trip"
                    onPress={() => openTrip(alert)}
                  />
                </RegistryCardActions>
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    backgroundColor: Theme.cardWhite,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    backgroundColor: Theme.cardWhite,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: METRONIC.primaryBtn,
    letterSpacing: -0.1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    paddingLeft: 12,
    paddingRight: 10,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: METRONIC.border,
    backgroundColor: Theme.cardWhite,
  },
  tabItem: {
    position: "relative",
    paddingBottom: 8,
    alignItems: "center",
    gap: 4,
    minWidth: 32,
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    position: "relative",
    paddingRight: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: METRONIC.muted,
  },
  tabTextActive: {
    color: Theme.primary,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Theme.buttonPrimary,
  },
  tabUnreadDot: {
    position: "absolute",
    top: -1,
    right: -5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50CD89",
    borderWidth: 1,
    borderColor: Theme.cardWhite,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.cardWhite,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyWrap: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: METRONIC.primaryBtn,
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: METRONIC.muted,
    lineHeight: 18,
  },
});
