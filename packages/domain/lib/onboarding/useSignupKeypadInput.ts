import { Platform, useWindowDimensions } from 'react-native';

/** Match signup wizard / dense form breakpoint. */
const MOBILE_WEB_KEYPAD_MAX_WIDTH = 600;

/**
 * Custom docked keypad on native and narrow web.
 * Desktop web keeps OS keyboard + TextInput.
 */
export function useSignupKeypadInput(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'ios' || Platform.OS === 'android') return true;
  return Platform.OS === 'web' && width < MOBILE_WEB_KEYPAD_MAX_WIDTH;
}
