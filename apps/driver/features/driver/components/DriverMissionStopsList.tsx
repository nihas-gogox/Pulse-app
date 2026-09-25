/**
 * Multi-stop mission list. Arrive/complete only on the current stop.
 * Presentation follows a shipment-card pattern (current stop, Pickup/Delivery
 * chips, full-width CTA) using Driver theme colors — not a new execution path.
 */
import Layout from '@pulse/core/constants/Layout';
import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';
import {
  canShowArriveAction,
  canShowCompleteAction,
} from '../execution/resolveDriverStopTransition';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { LoadingIndicator } from '@pulse/ui/components/LoadingIndicator';
import { MapPin, Phone } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

function formatAddress(stop: DriverStopExecutionStop): string | null {
  const parts = [stop.addressLine, stop.city, stop.state, stop.pincode]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(', ') : null;
}

function stopKind(stopType: string): 'pickup' | 'drop' | 'other' {
  const t = stopType.trim().toLowerCase();
  if (t === 'pickup') return 'pickup';
  if (t === 'drop') return 'drop';
  return 'other';
}

function formatStopType(stopType: string): string {
  const kind = stopKind(stopType);
  if (kind === 'pickup') return 'Pickup';
  if (kind === 'drop') return 'Delivery';
  return stopType.trim() || 'Stop';
}

function formatStatus(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === 'pending') return 'Awaiting';
  if (s === 'arrived') return 'On site';
  if (s === 'completed') return 'Done';
  if (!status) return 'Awaiting';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function actionLabel(stop: DriverStopExecutionStop, arrive: boolean): string {
  const kind = stopKind(String(stop.stopType));
  if (arrive) {
    return kind === 'pickup' ? 'Ready to pickup' : 'Arrive at stop';
  }
  return kind === 'drop' ? 'Confirm delivery' : 'Complete pickup';
}

export function DriverMissionStopsList({
  stops,
  currentStopId,
  onArrive,
  onComplete,
  actionBusy = false,
}: {
  stops: readonly DriverStopExecutionStop[];
  currentStopId: string | null;
  onArrive?: () => void;
  onComplete?: () => void;
  actionBusy?: boolean;
}) {
  const colors = useDriverThemeColors();
  const current = useMemo(
    () => stops.find((s) => s.stopId === currentStopId) ?? null,
    [stops, currentStopId],
  );
  const [focusKind, setFocusKind] = useState<'pickup' | 'drop'>(() =>
    current && stopKind(String(current.stopType)) === 'drop' ? 'drop' : 'pickup',
  );

  useEffect(() => {
    if (!current) return;
    const kind = stopKind(String(current.stopType));
    if (kind === 'pickup' || kind === 'drop') setFocusKind(kind);
  }, [current]);

  if (stops.length === 0) return null;

  const focusedStops = stops.filter((s) => {
    if (s.stopId === currentStopId) return false;
    const kind = stopKind(String(s.stopType));
    if (kind === 'other') return focusKind === 'pickup';
    return kind === focusKind;
  });

  const showArrive = !!current && !!onArrive && canShowArriveAction(current, currentStopId);
  const showComplete =
    !!current && !!onComplete && canShowCompleteAction(current, currentStopId);
  const address = current ? formatAddress(current) : null;
  const phone = current?.contactPhone?.trim() || null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]} accessibilityRole="summary">
      <View
        style={[styles.segment, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      >
        {(['pickup', 'drop'] as const).map((kind) => {
          const selected = focusKind === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => setFocusKind(kind)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={kind === 'pickup' ? 'Pickup stops' : 'Delivery stops'}
              style={[
                styles.segmentBtn,
                selected && { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.text : colors.textMuted },
                ]}
              >
                {kind === 'pickup' ? 'Pickup' : 'Delivery'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.progressRow}>
        {stops.map((stop, index) => {
          const done = stop.status === 'completed' || stop.status === 'skipped';
          const isCurrent = stop.stopId === currentStopId;
          return (
            <React.Fragment key={stop.stopId}>
              {index > 0 ? (
                <View
                  style={[
                    styles.progressLine,
                    { backgroundColor: done || isCurrent ? colors.emerald : colors.border },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: done
                      ? colors.emerald
                      : isCurrent
                        ? colors.primary
                        : colors.surfaceElevated,
                    borderColor: isCurrent ? colors.primary : colors.border,
                  },
                ]}
              />
            </React.Fragment>
          );
        })}
      </View>

      {current ? (
        <View
          style={[
            styles.currentCard,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.currentTop}>
            <View
              style={[
                styles.kindPill,
                { backgroundColor: colors.emeraldMuted, borderColor: colors.emeraldBorder },
              ]}
            >
              <Text style={[styles.kindPillText, { color: colors.emerald }]}>
                {formatStopType(String(current.stopType))}
              </Text>
            </View>
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              {formatStatus(current.status)}
              {' · '}
              {current.sequence}/{stops.length}
            </Text>
          </View>
          <Text style={[styles.currentName, { color: colors.text }]} numberOfLines={2}>
            {current.displayName}
          </Text>
          {current.contactName?.trim() ? (
            <Text style={[styles.contact, { color: colors.text }]} numberOfLines={1}>
              {current.contactName.trim()}
            </Text>
          ) : null}
          {address ? (
            <View style={styles.addressRow}>
              <MapPin size={14} color={colors.textMuted} strokeWidth={2} />
              <Text style={[styles.address, { color: colors.textMuted }]} numberOfLines={2}>
                {address}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${phone}`)}
              accessibilityRole="button"
              accessibilityLabel="Call stop contact"
              hitSlop={Layout.touchTargetHitSlop}
              style={[styles.callBtn, { borderColor: colors.border }]}
            >
              <Phone size={16} color={colors.emerald} strokeWidth={2} />
              <Text style={[styles.callText, { color: colors.emerald }]}>Call</Text>
            </Pressable>
          ) : null}
          {showArrive || showComplete ? (
            <Pressable
              onPress={showArrive ? onArrive : onComplete}
              disabled={actionBusy}
              accessibilityRole="button"
              accessibilityLabel={actionLabel(current, showArrive)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.emerald, opacity: actionBusy ? 0.6 : pressed ? 0.88 : 1 },
              ]}
            >
              {actionBusy ? (
                <LoadingIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>
                  {actionLabel(current, showArrive)}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {focusedStops.length > 0 ? (
        <View style={styles.queue}>
          {focusedStops.map((stop) => {
            const isCurrent = stop.stopId === currentStopId;
            const line = formatAddress(stop);
            return (
              <View
                key={stop.stopId}
                style={[
                  styles.queueRow,
                  {
                    borderColor: isCurrent ? colors.emeraldBorder : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.queueSeq, { color: colors.textMuted }]}>{stop.sequence}</Text>
                <View style={styles.queueBody}>
                  <Text style={[styles.queueName, { color: colors.text }]} numberOfLines={1}>
                    {stop.displayName}
                  </Text>
                  {line ? (
                    <Text style={[styles.queueAddr, { color: colors.textMuted }]} numberOfLines={1}>
                      {line}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.queueStatus, { color: colors.textMuted }]}>
                  {formatStatus(stop.status)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  currentCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  currentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  currentName: {
    fontSize: 18,
    fontWeight: '800',
  },
  contact: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  address: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  callBtn: {
    alignSelf: 'flex-start',
    minHeight: Layout.minTouchTargetSize,
    minWidth: Layout.minTouchTargetSize,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtn: {
    marginTop: 4,
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
  },
  queue: {
    gap: 8,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  queueSeq: {
    fontSize: 13,
    fontWeight: '800',
    width: 20,
  },
  queueBody: {
    flex: 1,
    minWidth: 0,
  },
  queueName: {
    fontSize: 14,
    fontWeight: '700',
  },
  queueAddr: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  queueStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
});
