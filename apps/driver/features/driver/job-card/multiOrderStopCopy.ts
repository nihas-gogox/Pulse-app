import type { DriverStopExecutionStop } from '../execution/driverStopExecution.types';

export function formatStopPlace(stop: {
  displayName?: string | null;
  city?: string | null;
  addressLine?: string | null;
  sequence?: number;
}): string {
  return stop.displayName?.trim()
    || stop.city?.trim()
    || stop.addressLine?.trim()
    || (stop.sequence != null ? `Stop ${stop.sequence}` : 'Stop');
}

export function isDeliveryStop(stopType: string | null | undefined): boolean {
  return (stopType ?? '').trim().toLowerCase() === 'drop';
}

export function stopRoleLabel(stopType: string | null | undefined): 'Pickup' | 'Delivery' {
  return isDeliveryStop(stopType) ? 'Delivery' : 'Pickup';
}

export function formatStopKm(km: number | null | undefined): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}

export type MultiOrderActionKind = 'arrive' | 'complete';

export type MultiOrderActionModel = {
  kind: MultiOrderActionKind | 'idle';
  stageLabel: string | null;
  hint: string | null;
  cta: string | null;
};

/**
 * Driver-facing copy for the current stop. Backend remains arrive/complete.
 */
export function multiOrderActionModel(
  stop: DriverStopExecutionStop | null,
  orderCount: number,
): MultiOrderActionModel {
  if (!stop) {
    return { kind: 'idle', stageLabel: 'Route complete', hint: null, cta: null };
  }

  const delivery = isDeliveryStop(String(stop.stopType));
  const status = stop.status;

  if (status === 'pending') {
    return {
      kind: 'arrive',
      stageLabel: null,
      hint: null,
      cta: delivery ? 'Ready to deliver' : 'Ready to pick up',
    };
  }

  if (status === 'arrived') {
    if (delivery) {
      const n = orderCount > 0 ? orderCount : 1;
      return {
        kind: 'complete',
        stageLabel: 'At customer',
        hint: n === 1 ? '1 order to deliver' : `${n} orders to deliver`,
        cta: 'Verify delivery',
      };
    }
    return {
      kind: 'complete',
      stageLabel: 'At pickup',
      hint: 'Review items before you confirm',
      cta: 'Verify pickup',
    };
  }

  if (status === 'completed') {
    return {
      kind: 'idle',
      stageLabel: delivery ? 'Delivered' : 'Pickup completed',
      hint: null,
      cta: null,
    };
  }

  if (status === 'skipped') {
    return { kind: 'idle', stageLabel: 'Stop skipped', hint: null, cta: null };
  }

  if (status === 'failed') {
    return { kind: 'idle', stageLabel: 'Could not complete this stop', hint: null, cta: null };
  }

  return { kind: 'idle', stageLabel: null, hint: null, cta: null };
}

export function callActionLabel(stopType: string | null | undefined): string {
  return isDeliveryStop(stopType) ? 'Call customer' : 'Call warehouse';
}
