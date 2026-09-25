import {
  allStopsFinished,
  buildTripCompletionSummary,
  tripCompletionHeadline,
} from '../tripCompletionSummary';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import type { DriverTripStopOrderMission } from '../../commerce-mission/driverTripStopOrders.types';

function stop(
  extras: Partial<DriverStopExecutionStop> & Pick<DriverStopExecutionStop, 'stopId' | 'sequence' | 'stopType' | 'status'>,
): DriverStopExecutionStop {
  return {
    displayName: extras.displayName ?? extras.stopId,
    addressLine: null,
    city: null,
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
    ...extras,
  };
}

describe('tripCompletionSummary', () => {
  it('is finished only when every stop is completed or skipped', () => {
    expect(allStopsFinished([])).toBe(false);
    expect(
      allStopsFinished([
        stop({ stopId: 'a', sequence: 1, stopType: 'pickup', status: 'completed' }),
        stop({ stopId: 'b', sequence: 2, stopType: 'drop', status: 'pending' }),
      ]),
    ).toBe(false);
    expect(
      allStopsFinished([
        stop({ stopId: 'a', sequence: 1, stopType: 'pickup', status: 'completed' }),
        stop({ stopId: 'b', sequence: 2, stopType: 'drop', status: 'skipped' }),
      ]),
    ).toBe(true);
  });

  it('counts delivery items once across pickup and drop of the same order', () => {
    const mission = {
      tripId: 't1',
      indentId: null,
      executionPlanId: 'p1',
      stops: [
        {
          stopId: 'pu',
          orders: [
            {
              salesOrderId: 'so-1',
              orderNumber: 'SO-1',
              customerId: null,
              customerName: 'Acme',
              customerPhone: null,
              attachmentRole: 'pickup',
              lines: [{ salesOrderLineId: 'l1', quantity: 15 }],
            },
          ],
        },
        {
          stopId: 'dr',
          orders: [
            {
              salesOrderId: 'so-1',
              orderNumber: 'SO-1',
              customerId: null,
              customerName: 'Acme',
              customerPhone: null,
              attachmentRole: 'drop',
              lines: [{ salesOrderLineId: 'l1', quantity: 15 }],
            },
          ],
        },
      ],
    } as unknown as DriverTripStopOrderMission;
    const summary = buildTripCompletionSummary(
      [
        stop({ stopId: 'pu', sequence: 1, stopType: 'pickup', status: 'completed', displayName: 'WH' }),
        stop({ stopId: 'dr', sequence: 2, stopType: 'drop', status: 'completed', displayName: 'Drop E' }),
      ],
      mission,
    );
    expect(summary.pickupStops).toBe(1);
    expect(summary.deliveryStops).toBe(1);
    expect(summary.distinctOrders).toBe(1);
    expect(summary.expectedItems).toBe(15);
    expect(tripCompletionHeadline(summary)).toContain('15 items on trip');
    expect(summary.stops[1]?.orderLabels).toEqual(['SO-1']);
  });
});
