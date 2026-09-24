/**
 * Narrow Driver types for stop_execution_state + execution_plan_stops.
 * Generated database.types.ts is stale (no SES table / incomplete stop columns).
 */

export type DriverStopExecutionStatus =
  | 'pending'
  | 'arrived'
  | 'completed'
  | 'skipped'
  | 'failed';

export type DriverStopType = 'pickup' | 'drop' | string;

export interface DriverStopExecutionStop {
  stopId: string;
  sequence: number;
  stopType: DriverStopType;
  displayName: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  podRequired: boolean;
  status: DriverStopExecutionStatus;
  driverId: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  skipReason: string | null;
  failureReason: string | null;
}

export interface DriverStopExecutionBundle {
  tripId: string;
  stops: DriverStopExecutionStop[];
}

/** Planning snapshot from execution_plan_stops (join). */
export interface DriverPlanStopRow {
  id?: string | null;
  stop_type?: string | null;
  display_name?: string | null;
  label?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  pod_required?: boolean | null;
}

/** Raw SES row + optional embedded plan stop. */
export interface DriverSesJoinRow {
  trip_id?: string | null;
  stop_id?: string | null;
  sequence?: number | null;
  status?: string | null;
  driver_id?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  skip_reason?: string | null;
  failure_reason?: string | null;
  execution_plan_stops?: DriverPlanStopRow | DriverPlanStopRow[] | null;
}
