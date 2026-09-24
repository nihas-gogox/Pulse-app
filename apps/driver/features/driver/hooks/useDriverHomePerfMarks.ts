/**
 * Phase 0: wires DriverHomeScreen milestones into lib/driverPerfMetrics.
 * No behavior changes — marks only (dev no-ops in production).
 */
import { useEffect, useRef } from 'react';
import {
  markDriverPerfPhase,
  noteDriverHomeRender,
} from '@pulse/domain/lib/driverPerfMetrics';

export type DriverHomePerfMarksInput = {
  loading: boolean;
  tripsSyncing: boolean;
  driversFetched: boolean;
  driversFetching: boolean;
  hasDriverRows: boolean;
  shouldShowMap: boolean;
  showDashboardMapPreview: boolean;
  activeTripId: string | null;
};

export function useDriverHomePerfMarks(input: DriverHomePerfMarksInput): void {
  noteDriverHomeRender();

  const {
    loading,
    tripsSyncing,
    driversFetched,
    driversFetching,
    hasDriverRows,
    shouldShowMap,
    showDashboardMapPreview,
    activeTripId,
  } = input;

  const sawTripsSyncStart = useRef(false);

  useEffect(() => {
    if (!driversFetched && !driversFetching) return;
    if (driversFetching) {
      markDriverPerfPhase('drivers_query_start');
      return;
    }
    if (driversFetched) {
      markDriverPerfPhase('drivers_query_done');
    }
  }, [driversFetched, driversFetching]);

  useEffect(() => {
    if (tripsSyncing) {
      sawTripsSyncStart.current = true;
      markDriverPerfPhase('trips_query_start');
      return;
    }
    if (sawTripsSyncStart.current || (driversFetched && !loading)) {
      markDriverPerfPhase('trips_query_done');
    }
  }, [tripsSyncing, driversFetched, loading]);

  useEffect(() => {
    if (loading) return;
    // Interactive once skeleton loading ends and drivers query settled.
    if (!driversFetched) return;
    if (hasDriverRows && tripsSyncing) return;
    markDriverPerfPhase('dashboard_interactive');
  }, [loading, driversFetched, hasDriverRows, tripsSyncing]);

  useEffect(() => {
    if (shouldShowMap || showDashboardMapPreview) {
      markDriverPerfPhase('map_first_render');
    }
  }, [shouldShowMap, showDashboardMapPreview]);

  useEffect(() => {
    if (activeTripId) {
      markDriverPerfPhase('active_trip_first_render');
    }
  }, [activeTripId]);
}
