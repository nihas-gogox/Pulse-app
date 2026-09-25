import React from 'react';
import { DriverMissionStopsList } from '../DriverMissionStopsList';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('@pulse/ui/contexts/DriverThemeContext', () => ({
  useDriverThemeColors: () => ({
    background: '#f8fafc',
    surface: '#fff',
    surfaceElevated: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    textOnPrimary: '#fff',
    primary: '#059669',
    emerald: '#047857',
    emeraldMuted: 'rgba(4,120,87,0.12)',
    emeraldBorder: 'rgba(4,120,87,0.38)',
  }),
}));

function stop(
  extras: Partial<DriverStopExecutionStop> & Pick<DriverStopExecutionStop, 'stopId' | 'sequence' | 'stopType' | 'status'>,
): DriverStopExecutionStop {
  return {
    displayName: extras.displayName ?? `Stop ${extras.stopId}`,
    addressLine: '2464 Royal Ln',
    city: 'Mesa',
    state: 'NJ',
    pincode: '45463',
    latitude: null,
    longitude: null,
    contactName: extras.contactName ?? 'Holden',
    contactPhone: extras.contactPhone ?? null,
    podRequired: false,
    driverId: 'drv-1',
    arrivedAt: null,
    completedAt: null,
    skipReason: null,
    failureReason: null,
    ...extras,
  };
}

describe('DriverMissionStopsList', () => {
  const pickup = stop({
    stopId: 'pu-1',
    sequence: 1,
    stopType: 'pickup',
    status: 'pending',
    displayName: 'Warehouse A',
  });
  const drop = stop({
    stopId: 'dr-1',
    sequence: 2,
    stopType: 'drop',
    status: 'pending',
    displayName: 'Birthday gifts',
  });

  it('shows Ready to pickup on the current pending pickup', () => {
    const onArrive = jest.fn();
    const { getByLabelText, getByText } = render(
      <DriverMissionStopsList
        stops={[pickup, drop]}
        currentStopId="pu-1"
        onArrive={onArrive}
        onComplete={jest.fn()}
      />,
    );
    expect(getByText('Warehouse A')).toBeTruthy();
    fireEvent.press(getByLabelText('Ready to pickup'));
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('shows Confirm delivery when the current drop is arrived', () => {
    const onComplete = jest.fn();
    const arrivedDrop = { ...drop, status: 'arrived' as const };
    const { getByLabelText } = render(
      <DriverMissionStopsList
        stops={[{ ...pickup, status: 'completed' }, arrivedDrop]}
        currentStopId="dr-1"
        onArrive={jest.fn()}
        onComplete={onComplete}
      />,
    );
    fireEvent.press(getByLabelText('Confirm delivery'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not put arrive/complete on a non-current stop', () => {
    const { queryByLabelText } = render(
      <DriverMissionStopsList
        stops={[pickup, drop]}
        currentStopId="pu-1"
        onArrive={jest.fn()}
        onComplete={jest.fn()}
      />,
    );
    expect(queryByLabelText('Arrive at stop')).toBeNull();
    expect(queryByLabelText('Confirm delivery')).toBeNull();
  });
});
