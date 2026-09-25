import { DriverCommerceMissionEntry } from '../DriverCommerceMissionEntry';
import { ROUTES } from '@pulse/core/lib/routes';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockUseDriverCommerceMission = jest.fn();

jest.mock('react-native', () => jest.requireActual('react-native'));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@pulse/ui/contexts/DriverThemeContext', () => ({
  useDriverThemeColors: () => ({
    text: '#111',
    textMuted: '#666',
    surface: '#fff',
    borderSubtle: '#ddd',
  }),
}));

jest.mock('../useDriverCommerceMission', () => ({
  useDriverCommerceMission: (...args: unknown[]) => mockUseDriverCommerceMission(...args),
}));

describe('DriverCommerceMissionEntry', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseDriverCommerceMission.mockReset();
  });

  it('renders the CTA without hydrating Primitive A', () => {
    const { getByText, getByTestId } = render(<DriverCommerceMissionEntry tripId="trip-1" />);
    expect(getByTestId('commerce-mission-entry')).toBeTruthy();
    expect(getByText('Delivery Mission')).toBeTruthy();
    expect(getByText('View orders')).toBeTruthy();
    expect(mockUseDriverCommerceMission).not.toHaveBeenCalled();
  });

  it('navigates to the read-only Commerce mission route on press', () => {
    const { getByTestId } = render(<DriverCommerceMissionEntry tripId="trip-9" />);
    fireEvent.press(getByTestId('commerce-mission-entry'));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.driverCommerceMission('trip-9'));
    expect(mockUseDriverCommerceMission).not.toHaveBeenCalled();
  });
});
