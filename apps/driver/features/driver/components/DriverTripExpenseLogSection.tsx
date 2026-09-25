import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Theme from "@pulse/core/constants/Theme";
import { useAuth } from "@pulse/domain/contexts/AuthContext";
import { useDriverThemeColors } from "@pulse/ui/contexts/DriverThemeContext";
import { tripHistoryDetailStyles as td } from "../tripHistory/tripHistoryDetail.styles";
import type { TripCostEvent, TripCostCategory } from "@pulse/domain/features/finance/domain/tripCostEvent";
import { ExpenseEntryDetailPanel } from "../../trips/operations/hub/ExpenseEntryDetailPanel";
import {
  useCancelDriverExpenseRequest,
  useRemindDriverExpenseRequest,
} from "@pulse/domain/features/trips/operations/queries/useTripOperations";
import { isDriverReimbursementCostEvent } from "@pulse/domain/features/trips/operations/shared/driverReimbursementEvents.util";
import { formatOtherExpenseCategoryLabel } from "@pulse/domain/features/trips/operations/shared/tripOtherExpenseCategories";
import { normalizeTripOtherExpenseCategory } from "@pulse/domain/features/trips/operations/shared/driverExpenseCategoryNav.util";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";

type ExpenseFilter = "pending" | "approved";

type CategoryVisual = {
  bg: string;
  fg: string;
  icon: ComponentProps<typeof Feather>["name"];
};

function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function toCategoryLabel(event: TripCostEvent): string {
  if (event.id.startsWith("other:")) {
    const normalized = normalizeTripOtherExpenseCategory(event.category);
    return formatOtherExpenseCategoryLabel(normalized);
  }
  const raw = event.category;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function categoryVisual(category: TripCostCategory): CategoryVisual {
  switch (category) {
    case "fuel":
      return { bg: "rgba(4,120,87,0.14)", fg: Theme.driverEmeraldDark, icon: "droplet" };
    case "toll":
    case "fastag":
      return { bg: "#ede9fe", fg: "#6d28d9", icon: "map-pin" };
    default:
      return { bg: "#f1f5f9", fg: "#475569", icon: "file-text" };
  }
}

function isPendingExpense(event: TripCostEvent): boolean {
  return event.approvalState === "pending" || event.approvalState === "rejected";
}

function isApprovedExpense(event: TripCostEvent): boolean {
  return event.approvalState === "approved";
}

function statusLabel(event: TripCostEvent): string {
  if (event.approvalState === "pending") return "Awaiting fleet";
  if (event.approvalState === "rejected") return "Cancelled";
  if (event.settlementState === "settled") return "Reimbursed";
  if (event.approvalState === "approved") return "Approved";
  return "Submitted";
}

type Props = {
  trip: TripRow;
  events: TripCostEvent[];
  loading?: boolean;
  initialSelectedEventId?: string | null;
  onAddExpense?: () => void;
  onEditExpense?: (event: TripCostEvent) => void;
};

export function DriverTripExpenseLogSection({
  trip,
  events: allEvents,
  loading = false,
  initialSelectedEventId,
  onAddExpense,
  onEditExpense,
}: Props) {
  const colors = useDriverThemeColors();
  const { profile } = useAuth();

  const [filter, setFilter] = useState<ExpenseFilter>("pending");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const deepLinkAppliedRef = useRef(false);

  const cancelDriverExpense = useCancelDriverExpenseRequest();
  const remindDriverExpense = useRemindDriverExpenseRequest();
  const loadingAction = cancelDriverExpense.isPending || remindDriverExpense.isPending;

  const events = useMemo(
    () =>
      allEvents
        .filter(isDriverReimbursementCostEvent)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [allEvents],
  );

  const pendingEvents = useMemo(() => events.filter(isPendingExpense), [events]);
  const approvedEvents = useMemo(() => events.filter(isApprovedExpense), [events]);
  const displayedEvents = filter === "pending" ? pendingEvents : approvedEvents;

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (deepLinkAppliedRef.current || loading) return;
    const id = initialSelectedEventId?.trim();
    if (!id) return;
    const match = events.find((event) => event.id === id);
    if (!match) return;
    deepLinkAppliedRef.current = true;
    setSelectedEventId(match.id);
    setFilter(isApprovedExpense(match) ? "approved" : "pending");
  }, [events, initialSelectedEventId, loading]);

  useEffect(() => {
    if (selectedEventId && !displayedEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [displayedEvents, selectedEventId]);

  const handleToggleEntry = useCallback((eventId: string) => {
    setSelectedEventId((prev) => (prev === eventId ? null : eventId));
  }, []);

  const handleCancelRequest = useCallback(
    (event: TripCostEvent) => {
      Alert.alert(
        "Cancel reimbursement request?",
        `Remove ${toCategoryLabel(event)} (${inr(event.amount)}) from fleet review?`,
        [
          { text: "Keep request", style: "cancel" },
          {
            text: "Cancel request",
            style: "destructive",
            onPress: () => {
              void cancelDriverExpense
                .mutateAsync({
                  tripId: trip.id,
                  eventId: event.id,
                  actorUserId: profile?.uid ?? null,
                  organizationId: trip.organization_id,
                })
                .then(() => setSelectedEventId(null))
                .catch((e) => {
                  Alert.alert(
                    "Could not cancel request",
                    e instanceof Error ? e.message : "Unknown error",
                  );
                });
            },
          },
        ],
      );
    },
    [cancelDriverExpense, profile?.uid, trip.id, trip.organization_id],
  );

  const handleRemindRequest = useCallback(
    async (event: TripCostEvent) => {
      try {
        await remindDriverExpense.mutateAsync({
          tripId: trip.id,
          eventId: event.id,
          actorUserId: profile?.uid ?? null,
          organizationId: trip.organization_id,
        });
        Alert.alert(
          "Reminder sent",
          "Fleet owner will see this reimbursement request at the top of their queue.",
        );
      } catch (e) {
        Alert.alert(
          "Could not send reminder",
          e instanceof Error ? e.message : "Unknown error",
        );
      }
    },
    [profile?.uid, remindDriverExpense, trip.id, trip.organization_id],
  );

  return (
    <View style={styles.wrap}>
      {onAddExpense ? (
        <View
          style={[
            td.tdTimelineCard,
            styles.addExpenseCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.addExpenseRow,
              pressed && styles.addExpenseRowPressed,
            ]}
            onPress={onAddExpense}
            accessibilityRole="button"
            accessibilityLabel="Log expense"
          >
            <View style={[styles.addExpenseIcon, { backgroundColor: colors.emeraldDark }]}>
              <Feather name="plus" size={14} color="#fff" />
            </View>
            <View style={styles.addExpenseCopy}>
              <Text style={[td.tdLogStatus, { color: colors.text }]}>Log expense</Text>
              <Text style={[td.tdLogLoc, { color: colors.textMuted }]} numberOfLines={1}>
                Fuel, toll, parking & other costs
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={[td.tdTabBar, styles.segmentBar, { backgroundColor: `${colors.border}99` }]}>
        <Pressable
          style={[td.tdTabBtn, filter === "pending" && td.tdTabBtnActive]}
          onPress={() => {
            setFilter("pending");
            setSelectedEventId(null);
          }}
        >
          <Text
            style={[
              td.tdTabLabel,
              { color: filter === "pending" ? "#ffffff" : colors.textMuted },
            ]}
          >
            Pending · {pendingEvents.length}
          </Text>
        </Pressable>
        <Pressable
          style={[td.tdTabBtn, filter === "approved" && td.tdTabBtnActive]}
          onPress={() => {
            setFilter("approved");
            setSelectedEventId(null);
          }}
        >
          <Text
            style={[
              td.tdTabLabel,
              { color: filter === "approved" ? "#ffffff" : colors.textMuted },
            ]}
          >
            Approved · {approvedEvents.length}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View
          style={[
            td.tdTimelineCard,
            styles.stateCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator color={colors.emerald} />
          <Text style={[td.tdEmptyTimeline, { color: colors.textMuted }]}>Loading entries…</Text>
        </View>
      ) : events.length === 0 ? (
        <View
          style={[
            td.tdTimelineCard,
            styles.stateCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[td.tdLogStatus, styles.stateTitle, { color: colors.text }]}>No expenses yet</Text>
          <Text style={[td.tdEmptyTimeline, { color: colors.textMuted }]}>
            Log fuel, toll, or other costs you paid out of pocket.
          </Text>
        </View>
      ) : displayedEvents.length === 0 ? (
        <View
          style={[
            td.tdTimelineCard,
            styles.stateCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[td.tdLogStatus, styles.stateTitle, { color: colors.text }]}>
            {filter === "pending" ? "No pending entries" : "No approved entries"}
          </Text>
          <Text style={[td.tdEmptyTimeline, { color: colors.textMuted }]}>
            {filter === "pending"
              ? "New submissions awaiting fleet review appear here."
              : "Fleet-approved reimbursements appear here."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {displayedEvents.map((event) => {
            const visual = categoryVisual(event.category);
            const expanded = selectedEventId === event.id;
            return (
              <View
                key={event.id}
                style={[
                  td.tdTimelineCard,
                  styles.entryGroup,
                  {
                    backgroundColor: colors.surface,
                    borderColor: expanded ? colors.emerald : colors.border,
                  },
                ]}
              >
                <Pressable
                  style={[
                    td.tdLogTouchable,
                    expanded && { backgroundColor: colors.surfaceElevated, borderRadius: 10 },
                  ]}
                  onPress={() => handleToggleEntry(event.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={td.tdLogMarkerCol}>
                    <View style={[styles.entryIcon, { backgroundColor: visual.bg }]}>
                      <Feather name={visual.icon} size={12} color={visual.fg} />
                    </View>
                  </View>
                  <View style={td.tdLogBody}>
                    <View style={td.tdLogHead}>
                      <Text style={[td.tdLogStatus, { color: colors.text }]} numberOfLines={1}>
                        {toCategoryLabel(event)}
                      </Text>
                      <View style={td.tdLogHeadRight}>
                        <Text style={[td.tdLogMetaV, styles.entryAmount, { color: colors.text }]}>
                          {inr(event.amount)}
                        </Text>
                        <Feather
                          name={expanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={expanded ? colors.emerald : colors.textMuted}
                        />
                      </View>
                    </View>
                    <Text style={[td.tdLogLoc, { color: colors.textMuted }]} numberOfLines={1}>
                      {new Date(event.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {statusLabel(event)}
                    </Text>
                  </View>
                </Pressable>

                {expanded && selectedEvent ? (
                  <>
                    <View style={[styles.entryDivider, { backgroundColor: colors.border }]} />
                    <ExpenseEntryDetailPanel
                      inline
                      event={selectedEvent}
                      statusLabel={statusLabel(selectedEvent)}
                      loadingAction={loadingAction}
                      onEdit={onEditExpense}
                      onRemind={handleRemindRequest}
                      onCancel={handleCancelRequest}
                    />
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  addExpenseCard: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  addExpenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  addExpenseRowPressed: {
    opacity: 0.88,
  },
  addExpenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addExpenseCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  segmentBar: {
    marginBottom: 10,
  },
  list: {
    gap: 0,
  },
  entryGroup: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: "hidden",
  },
  entryDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  entryIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  entryAmount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  stateCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  stateTitle: {
    textAlign: "center",
  },
});
