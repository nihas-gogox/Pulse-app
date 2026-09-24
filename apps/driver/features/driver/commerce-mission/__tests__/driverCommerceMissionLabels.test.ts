import {
  formatStopAddress,
  stopExecutionLabel,
  stopKindLabel,
} from '../driverCommerceMissionLabels';

describe('driverCommerceMissionLabels', () => {
  it('labels pickup and drop without calling them delivered', () => {
    expect(stopKindLabel('pickup')).toBe('Pickup');
    expect(stopKindLabel('drop')).toBe('Drop');
  });

  it('maps SES without inventing order delivery', () => {
    expect(stopExecutionLabel('pending')).toBe('Awaiting');
    expect(stopExecutionLabel('arrived')).toBe('Arrived');
    expect(stopExecutionLabel('completed')).toBe('Stop completed');
    expect(stopExecutionLabel('completed')).not.toMatch(/delivered/i);
  });

  it('joins stop address snapshot', () => {
    expect(
      formatStopAddress({
        addressLine: '12 A',
        city: 'Chennai',
        state: 'TN',
        pincode: '600001',
      }),
    ).toBe('12 A, Chennai, TN, 600001');
  });
});
