/**
 * Multi-order Job Card — route → current stop → orders → one action.
 * Primitive A runs only while this card is mounted. Mode is never decided here.
 */
import Theme from '@pulse/core/constants/Theme';
import Layout from '@pulse/core/constants/Layout';
import { TRIP_SHEET_TOP_RADIUS } from '../../../components/driver/DriverTripSheetLayout';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { useDriverCommerceMission } from '../commerce-mission/useDriverCommerceMission';
import type { DriverTripFlowCardProps } from '../components/DriverTripFlowCard';
import type { DriverTripStopOrder } from '../commerce-mission/driverTripStopOrders.types';
import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';
import type { DriverStopExecutionController } from '../hooks/useDriverStopExecution';
import {
  canShowArriveAction,
  canShowCompleteAction,
} from '../execution/resolveDriverStopTransition';
import {
  distinctOrderCount,
  ordersOnStop,
} from './attachOrdersToStop';
import { buildDriverRoutePlanMap, routePlanKind } from './driverRoutePlanMap';
import {
  formatStopKm,
  formatStopPlace,
  isDeliveryStop,
  multiOrderActionModel,
} from './multiOrderStopCopy';
import {
  overlayCommerceStopsOnExecution,
  ROUTE_SETUP_PENDING_MESSAGE,
} from './sesStopsFromCommerceMission';
import { persistStopDeliveryProof } from './persistStopDeliveryProof';
import type { DeliveryProofDraft } from '@pulse/domain/features/driver/job-card/deliveryProof';
import { DriverStopVerificationScreen } from './DriverStopVerificationScreen';
import { DriverTripCompletionScreen } from './DriverTripCompletionScreen';
import { CurrentStopCard } from './parts/CurrentStopCard';
import { RouteProgressHeader } from './parts/RouteProgressHeader';
import { RouteProgressTrack } from './parts/RouteProgressTrack';
import { RouteScanList } from './parts/RouteScanList';
import { StopActionButton } from './parts/StopActionButton';
import { completedStopCount } from './attachOrdersToStop';
import { allStopsFinished } from './tripCompletionSummary';
import * as tripsService from '@pulse/domain/features/trips/services/trips.service';
import { ChevronUp } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = DriverTripFlowCardProps & {
  stopExecution: DriverStopExecutionController;
};

export function DriverMultiOrderJobCard({
  trip,
  stopExecution,
  collapsed = false,
  onToggleCollapse,
  edgeToEdge = false,
  variant = 'card',
  distanceToTargetKm,
  onRoutePlanMapChange,
  onShowRouteOnMap,
  onTripCompleted,
  onTripUpdated,
}: Props) {
  const colors = useDriverThemeColors();
  const { profile } = useAuth();
  const { mutating, arrive, complete } = stopExecution;
  const sesReady = stopExecution.stops.length > 0;
  const missionState = useDriverCommerceMission(trip.id);
  const mission = missionState.status === 'error' ? null : missionState.mission;
  const execution = useMemo(
    () => overlayCommerceStopsOnExecution(stopExecution, mission, trip),
    [stopExecution, mission, trip],
  );
  const { stops, currentStop, nextStop } = execution;
  const orderCount = distinctOrderCount(mission);
  const done = sesReady ? completedStopCount(stops) : 0;
  const [actionError, setActionError] = useState<string | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [markedComplete, setMarkedComplete] = useState(false);
  const summaryOfferedRef = useRef(false);
  const [verifySession, setVerifySession] = useState<{
    stop: DriverStopExecutionStop;
    orders: DriverTripStopOrder[];
    stopIndex: number;
    review: boolean;
  } | null>(null);

  const currentId = currentStop?.stopId ?? null;
  const routeFinished = sesReady && allStopsFinished(stops);
  const tripCompleted =
    markedComplete || String(trip.status ?? '').toLowerCase() === 'completed';
  const orders = ordersOnStop(mission, currentId);
  const canArrive = sesReady && currentStop ? canShowArriveAction(currentStop, currentId) : false;
  const canComplete = sesReady && currentStop ? canShowCompleteAction(currentStop, currentId) : false;
  const rawModel = multiOrderActionModel(currentStop, orders.length);
  const actionModel = !sesReady
    ? {
        kind: 'idle' as const,
        stageLabel: 'Route setup pending',
        hint: ROUTE_SETUP_PENDING_MESSAGE,
        cta: null,
      }
    : (rawModel.kind === 'arrive' && !canArrive) || (rawModel.kind === 'complete' && !canComplete)
      ? { ...rawModel, kind: 'idle' as const, cta: null }
      : rawModel;

  const later = useMemo(() => {
    if (!nextStop) return [];
    return stops.filter(
      (s) =>
        s.stopId !== currentId
        && s.stopId !== nextStop.stopId
        && s.sequence > nextStop.sequence
        && s.status !== 'completed'
        && s.status !== 'skipped',
    );
  }, [stops, nextStop, currentId]);

  const previous = useMemo(
    () =>
      stops.filter(
        (s) =>
          (s.status === 'completed' || s.status === 'skipped')
          && s.stopId !== currentId,
      ),
    [stops, currentId],
  );

  const focusKind = currentStop
    ? (routePlanKind(String(currentStop.stopType)) === 'drop' ? 'drop' : 'pickup')
    : 'pickup';

  useEffect(() => {
    if (!onRoutePlanMapChange) return;
    onRoutePlanMapChange(buildDriverRoutePlanMap(trip.id, stops, currentId, focusKind, currentId));
  }, [trip.id, stops, currentId, focusKind, onRoutePlanMapChange]);

  useEffect(() => {
    return () => onRoutePlanMapChange?.(null);
  }, [onRoutePlanMapChange]);

  useEffect(() => {
    if (!routeFinished || summaryOfferedRef.current) return;
    summaryOfferedRef.current = true;
    setSummaryOpen(true);
  }, [routeFinished]);

  const frameless = variant === 'page' || edgeToEdge;
  const inSheet = variant === 'page' || edgeToEdge;
  const remainingKmLabel = formatStopKm(distanceToTargetKm ?? undefined);
  const sheetStyle = [
    styles.sheet,
    { backgroundColor: colors.surface },
    frameless ? styles.edge : styles.inset,
  ];

  const openStopDetails = (stop: DriverStopExecutionStop, review: boolean) => {
    const stopIndex = Math.max(1, stops.findIndex((s) => s.stopId === stop.stopId) + 1);
    setVerifySession({
      stop,
      orders: ordersOnStop(mission, stop.stopId),
      stopIndex,
      review,
    });
    setVerified(review && (stop.status === 'completed' || stop.status === 'skipped'));
    setVerificationOpen(true);
  };

  const openVerification = () => {
    if (!sesReady || !currentStop) return;
    openStopDetails(currentStop, false);
  };

  const closeVerification = () => {
    setVerificationOpen(false);
    setVerified(false);
    setVerifySession(null);
  };

  const markDeliveryCompleted = () => {
    void (async () => {
      setCompletingTrip(true);
      setCompleteError(null);
      const now = new Date().toISOString();
      const { error, trip: updated } = await tripsService.updateTripStatus(trip.id, {
        status: 'completed',
        completed_at: now,
      });
      setCompletingTrip(false);
      if (error) {
        setCompleteError(error.message);
        setActionError(error.message);
        return;
      }
      setMarkedComplete(true);
      const next = updated ?? { ...trip, status: 'completed', completed_at: now, updated_at: now };
      onTripUpdated?.(next);
      await AsyncStorage.removeItem('driver_accepted_trip_id');
      onTripCompleted?.();
    })();
  };

  const runArrive = () => {
    if (!sesReady) {
      setActionError(ROUTE_SETUP_PENDING_MESSAGE);
      return;
    }
    void arrive().then((result) => {
      if (result.ignored) return;
      setActionError(result.ok ? null : result.error?.message ?? 'Could not arrive at this stop');
    });
  };
  const runComplete = (proof: DeliveryProofDraft) => {
    if (!sesReady) {
      setActionError(ROUTE_SETUP_PENDING_MESSAGE);
      return;
    }
    const stop = verifySession?.stop;
    const uid = profile?.uid;
    void (async () => {
      setProofBusy(true);
      try {
        if (stop) {
          if (!uid) {
            setActionError('Sign in is required to save stop proof');
            return;
          }
          const saved = await persistStopDeliveryProof({
            tripId: trip.id,
            stopId: stop.stopId,
            uploadedBy: uid,
            draft: proof,
            kind: isDeliveryStop(String(stop.stopType)) ? 'delivery' : 'pickup',
          });
          if (!saved.ok) {
            setActionError(saved.error.message);
            return;
          }
        }
        const result = await complete();
        if (result.ignored) return;
        if (!result.ok) {
          setActionError(result.error?.message ?? 'Could not finish this stop');
          return;
        }
        setActionError(null);
        setVerified(true);
      } finally {
        setProofBusy(false);
      }
    })();
  };

  if (collapsed && !inSheet && !verificationOpen) {
    return (
      <Pressable
        testID="driver-multi-order-job-card"
        onPress={() => onToggleCollapse?.()}
        style={[sheetStyle, styles.peek]}
        accessibilityRole="button"
        accessibilityLabel="Open today's route"
      >
        <RouteProgressHeader
          colors={colors}
          done={done}
          total={stops.length}
          orderCount={orderCount}
          remainingKmLabel={remainingKmLabel}
        />
        <RouteProgressTrack colors={colors} stops={stops} currentStopId={currentId} />
        {currentStop ? (
          <Text style={[styles.peekPlace, { color: colors.text }]} numberOfLines={1}>
            {formatStopPlace(currentStop)}
          </Text>
        ) : null}
        {actionModel.cta ? (
          <View style={[styles.peekCta, { backgroundColor: colors.emerald }]}>
            <Text style={[styles.peekCtaText, { color: colors.textOnPrimary }]}>
              {actionModel.cta}
            </Text>
          </View>
        ) : null}
        <View style={styles.peekHint}>
          <ChevronUp size={16} color={colors.emerald} strokeWidth={2.6} />
        </View>
      </Pressable>
    );
  }

  const nextOnRoute = verified ? currentStop : nextStop;
  const verifyOverlay =
    verificationOpen && verifySession ? (
      <DriverStopVerificationScreen
        stop={verifySession.stop}
        orders={verifySession.orders}
        stopIndex={verifySession.stopIndex}
        stopTotal={stops.length}
        ordersLoading={missionState.status === 'loading'}
        loadError={missionState.status === 'error' ? missionState.error.message : null}
        busy={mutating === 'complete' || proofBusy}
        confirmed={verified}
        review={verifySession.review}
        nextStop={
          nextOnRoute && nextOnRoute.stopId !== verifySession.stop.stopId ? nextOnRoute : null
        }
        onBack={closeVerification}
        onConfirm={runComplete}
        onViewNextStop={closeVerification}
      />
    ) : null;

  return (
    <View testID="driver-multi-order-job-card" style={sheetStyle}>
      <RouteProgressHeader
        colors={colors}
        done={done}
        total={stops.length}
        orderCount={orderCount}
        remainingKmLabel={remainingKmLabel}
        onViewTripPlan={onShowRouteOnMap}
      />
      <RouteProgressTrack colors={colors} stops={stops} currentStopId={currentId} />

      {currentStop && !routeFinished ? (
        <CurrentStopCard
          colors={colors}
          stop={currentStop}
          orders={orders}
          ordersLoading={missionState.status === 'loading'}
          distanceKm={distanceToTargetKm}
        >
          <StopActionButton
            colors={colors}
            model={actionModel}
            nextPlace={sesReady && nextStop ? formatStopPlace(nextStop) : null}
            busy={mutating != null}
            mutating={mutating}
            onArrive={runArrive}
            onComplete={openVerification}
          />
        </CurrentStopCard>
      ) : (
        <View style={styles.doneBlock}>
          <Text style={[styles.doneHint, { color: colors.textMuted }]}>
            {tripCompleted ? 'Delivery completed.' : 'All stops on this route are done.'}
          </Text>
          <Pressable
            onPress={() => setSummaryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={tripCompleted ? 'View delivery summary' : 'Review delivery summary'}
            style={[styles.summaryBtn, { borderColor: colors.emeraldBorder, backgroundColor: colors.emeraldMuted }]}
          >
            <Text style={[styles.summaryBtnText, { color: colors.emerald }]}>
              {tripCompleted ? 'View summary' : 'Review delivery summary'}
            </Text>
          </Pressable>
        </View>
      )}

      <RouteScanList
        colors={colors}
        previous={previous}
        current={currentStop}
        next={nextStop}
        later={later}
        mission={mission}
        onOpenStop={(stop) => {
          const confirmHere =
            sesReady && stop.stopId === currentId && stop.status === 'arrived';
          openStopDetails(stop, !confirmHere);
        }}
      />

      {actionError ? (
        <Text style={[styles.error, { color: Theme.negative }]} accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}
      {verifyOverlay}
      {summaryOpen ? (
        <DriverTripCompletionScreen
          stops={stops}
          mission={mission}
          tripCompleted={tripCompleted}
          busy={completingTrip}
          error={completeError}
          onBack={() => setSummaryOpen(false)}
          onMarkCompleted={markDeliveryCompleted}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopLeftRadius: TRIP_SHEET_TOP_RADIUS,
    borderTopRightRadius: TRIP_SHEET_TOP_RADIUS,
    gap: 8,
  },
  edge: { marginHorizontal: 0 },
  inset: { marginHorizontal: Layout.screenPaddingHorizontal },
  peek: { paddingBottom: 12, gap: 8 },
  peekPlace: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  peekCta: {
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekCtaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  peekHint: {
    alignItems: 'center',
  },
  doneHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  doneBlock: { gap: 8 },
  summaryBtn: {
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  summaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    fontSize: 12,
  },
});
