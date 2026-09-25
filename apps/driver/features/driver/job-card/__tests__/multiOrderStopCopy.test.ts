import {
  callActionLabel,
  formatStopKm,
  formatStopPlace,
  isDeliveryStop,
  multiOrderActionModel,
  stopRoleLabel,
} from '../multiOrderStopCopy';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';

function stop(partial: Partial<DriverStopExecutionStop> & Pick<DriverStopExecutionStop, 'status' | 'stopType'>): DriverStopExecutionStop {
  return {
    stopId: 's1',
    sequence: 1,
    displayName: 'Guindy Warehouse',
    addressLine: null,
    city: 'Chennai',
    state: null,
    pincode: null,
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    podRequired: false,
    driverId: null,
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
    ...partial,
  };
}

describe('multiOrderStopCopy', () => {
  it('maps drop to delivery language', () => {
    expect(isDeliveryStop('drop')).toBe(true);
    expect(stopRoleLabel('drop')).toBe('Delivery');
    expect(stopRoleLabel('pickup')).toBe('Pickup');
    expect(callActionLabel('pickup')).toBe('Call warehouse');
    expect(callActionLabel('drop')).toBe('Call customer');
  });

  it('pending pickup → Ready to pick up', () => {
    const model = multiOrderActionModel(stop({ status: 'pending', stopType: 'pickup' }), 2);
    expect(model.kind).toBe('arrive');
    expect(model.cta).toBe('Ready to pick up');
  });

  it('arrived pickup → Verify pickup', () => {
    const model = multiOrderActionModel(stop({ status: 'arrived', stopType: 'pickup' }), 2);
    expect(model.kind).toBe('complete');
    expect(model.stageLabel).toBe('At pickup');
    expect(model.cta).toBe('Verify pickup');
  });

  it('pending delivery → Ready to deliver', () => {
    const model = multiOrderActionModel(stop({ status: 'pending', stopType: 'drop' }), 1);
    expect(model.cta).toBe('Ready to deliver');
  });

  it('arrived delivery → Verify delivery', () => {
    const model = multiOrderActionModel(stop({ status: 'arrived', stopType: 'drop' }), 2);
    expect(model.stageLabel).toBe('At customer');
    expect(model.hint).toBe('2 orders to deliver');
    expect(model.cta).toBe('Verify delivery');
  });

  it('completed and failed have no CTA', () => {
    expect(multiOrderActionModel(stop({ status: 'completed', stopType: 'drop' }), 1).cta).toBeNull();
    expect(multiOrderActionModel(stop({ status: 'failed', stopType: 'pickup' }), 1).kind).toBe('idle');
  });

  it('formats place and km without inventing values', () => {
    expect(formatStopPlace({ displayName: '', city: 'Chennai', addressLine: 'Long street' })).toBe('Chennai');
    expect(formatStopKm(3.2)).toBe('3.2 km');
    expect(formatStopKm(null)).toBeNull();
  });
});
