import { resolveDriverJobExecutionMode } from '../resolveDriverJobExecutionMode';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';

function stop(partial: Partial<DriverStopExecutionStop> & { stopId: string }): DriverStopExecutionStop {
  return {
    sequence: 1,
    stopType: 'pickup',
    displayName: 'Warehouse',
    addressLine: null,
    city: null,
    state: null,
    pincode: null,
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    podRequired: false,
    status: 'pending',
    driverId: null,
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
    ...partial,
  };
}

describe('resolveDriverJobExecutionMode', () => {
  it('legacy when SES has no stops and no commerce signal', () => {
    expect(resolveDriverJobExecutionMode([])).toBe('legacy');
  });

  it('multi_order when SES has any stop — without Commerce RPC', () => {
    expect(resolveDriverJobExecutionMode([stop({ stopId: 's1' })])).toBe('multi_order');
  });

  it('multi_order when trip.is_commerce even if SES is empty', () => {
    expect(resolveDriverJobExecutionMode([], { isCommerceTrip: true })).toBe('multi_order');
  });
});
